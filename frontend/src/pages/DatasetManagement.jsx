import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Database, 
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const config = {
    completed: { icon: CheckCircle, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    processing: { icon: Clock, className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    pending: { icon: Clock, className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
    failed: { icon: AlertCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
  };
  
  const { icon: Icon, className } = config[status] || config.pending;
  
  return (
    <Badge className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  );
};

export default function DatasetManagement() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/datasets`);
      setDatasets(response.data || []);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const loadSampleData = async () => {
    setLoadingSample(true);
    try {
      const response = await axios.post(`${API}/datasets/sample`);
      toast.success(`Loaded ${response.data.total_reviews} sample reviews!`);
      fetchDatasets();
    } catch (error) {
      console.error("Error loading sample:", error);
      toast.error(error.response?.data?.detail || "Failed to load sample data");
    } finally {
      setLoadingSample(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/datasets/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Uploaded ${response.data.total_reviews} reviews!`);
      fetchDatasets();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Failed to upload dataset");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-8" data-testid="datasets-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Dataset Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage review datasets for analysis
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchDatasets}
          disabled={loading}
          data-testid="refresh-datasets-btn"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Upload Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* File Upload */}
        <Card data-testid="upload-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Upload className="h-5 w-5" />
              Upload Dataset
            </CardTitle>
            <CardDescription>
              Upload a CSV file with review data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`upload-zone rounded-sm p-8 text-center cursor-pointer transition-all ${
                dragActive ? 'border-accent bg-accent/5' : ''
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
              data-testid="upload-zone"
            >
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleInputChange}
                className="hidden"
                data-testid="file-input"
              />
              
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
                  <p className="font-medium">Processing...</p>
                  <p className="text-sm text-muted-foreground">Generating embeddings for reviews</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="font-medium">Drop CSV file here or click to browse</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Expected columns: review_text, rating, product_name
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sample Data */}
        <Card data-testid="sample-data-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Database className="h-5 w-5" />
              Sample Dataset
            </CardTitle>
            <CardDescription>
              Load sample Amazon product reviews for demonstration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-sm bg-secondary/50">
              <h4 className="font-medium mb-2">Sample Data Includes:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>40 realistic Amazon product reviews</li>
                <li>10 different product categories</li>
                <li>Mixed sentiment (positive, negative, neutral)</li>
                <li>Pre-categorized topics</li>
              </ul>
            </div>
            
            <Button 
              onClick={loadSampleData}
              disabled={loadingSample}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid="load-sample-btn"
            >
              {loadingSample ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading Sample Data...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Load Sample Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Datasets List */}
      <Card data-testid="datasets-list">
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Loaded Datasets
          </CardTitle>
          <CardDescription>
            View and manage your uploaded datasets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : datasets.length > 0 ? (
              <div className="space-y-4">
                {datasets.map((dataset, idx) => (
                  <div
                    key={dataset.id || idx}
                    className="p-4 rounded-sm border border-border"
                    data-testid={`dataset-item-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h4 className="font-medium">{dataset.name}</h4>
                        <p className="text-xs text-muted-foreground mono">
                          {new Date(dataset.created_at).toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge status={dataset.status} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="mono">
                          {dataset.processed_reviews} / {dataset.total_reviews}
                        </span>
                      </div>
                      <Progress 
                        value={(dataset.processed_reviews / dataset.total_reviews) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Database className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">No datasets loaded</p>
                <p className="text-sm">Upload a CSV file or load sample data to get started</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <h4 className="font-medium mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
            CSV Format Guide
          </h4>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground mb-2">Required columns (at least one):</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><code className="mono bg-muted px-1 rounded">review_text</code> or <code className="mono bg-muted px-1 rounded">reviewText</code> or <code className="mono bg-muted px-1 rounded">text</code></li>
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground mb-2">Optional columns:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><code className="mono bg-muted px-1 rounded">rating</code> or <code className="mono bg-muted px-1 rounded">overall</code> (1-5 scale)</li>
                <li><code className="mono bg-muted px-1 rounded">product_name</code> or <code className="mono bg-muted px-1 rounded">asin</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

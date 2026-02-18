import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Network, 
  Play, 
  RefreshCw,
  Layers,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CLUSTER_COLORS = [
  "#F97316", "#3B82F6", "#10B981", "#8B5CF6", 
  "#EF4444", "#06B6D4", "#F59E0B", "#EC4899",
  "#84CC16", "#6366F1"
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <Card className="border shadow-lg max-w-xs">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge 
              style={{ backgroundColor: CLUSTER_COLORS[data.cluster_id % CLUSTER_COLORS.length] }}
              className="text-white"
            >
              Cluster {data.cluster_id}
            </Badge>
            <Badge variant="outline" className={`sentiment-${data.sentiment}`}>
              {data.sentiment}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{data.topic}</p>
          <p className="text-xs leading-relaxed">{data.text}</p>
        </CardContent>
      </Card>
    );
  }
  return null;
};

export default function TopicExplorer() {
  const [scatterData, setScatterData] = useState([]);
  const [clusteringResults, setClusteringResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [nClusters, setNClusters] = useState([5]);
  const [selectedCluster, setSelectedCluster] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scatterRes, resultsRes] = await Promise.all([
        axios.get(`${API}/clustering/scatter-data`),
        axios.get(`${API}/clustering/results`)
      ]);
      
      setScatterData(scatterRes.data.data || []);
      if (resultsRes.data.clusters) {
        setClusteringResults(resultsRes.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runClustering = async () => {
    setClustering(true);
    try {
      const response = await axios.post(`${API}/clustering/run?n_clusters=${nClusters[0]}`);
      setClusteringResults(response.data);
      toast.success(`Clustering complete! ${nClusters[0]} clusters created`);
      
      // Refresh scatter data
      const scatterRes = await axios.get(`${API}/clustering/scatter-data`);
      setScatterData(scatterRes.data.data || []);
    } catch (error) {
      console.error("Clustering error:", error);
      toast.error(error.response?.data?.detail || "Clustering failed");
    } finally {
      setClustering(false);
    }
  };

  const filteredData = selectedCluster === "all" 
    ? scatterData 
    : scatterData.filter(d => d.cluster_id === parseInt(selectedCluster));

  return (
    <div className="space-y-8" data-testid="topic-explorer-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Topic Explorer
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize and explore review clusters based on semantic similarity
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={loading}
            data-testid="refresh-clusters-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Controls & Info */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Clustering Controls */}
        <Card className="lg:col-span-1" data-testid="clustering-controls">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Layers className="h-5 w-5" />
              Clustering
            </CardTitle>
            <CardDescription>
              Configure and run K-means clustering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm">Number of Clusters: <span className="mono font-medium">{nClusters[0]}</span></Label>
              <Slider
                value={nClusters}
                onValueChange={setNClusters}
                min={2}
                max={10}
                step={1}
                className="w-full"
                data-testid="cluster-slider"
              />
            </div>
            
            <Button 
              onClick={runClustering} 
              disabled={clustering}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid="run-clustering-btn"
            >
              {clustering ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Clustering
                </>
              )}
            </Button>

            {clusteringResults && (
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Silhouette Score</span>
                  <span className="font-medium mono">{clusteringResults.silhouette_score?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Clusters</span>
                  <span className="font-medium mono">{clusteringResults.n_clusters}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scatter Plot */}
        <Card className="lg:col-span-3" data-testid="scatter-plot">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Semantic Map
              </CardTitle>
              <CardDescription>
                Reviews plotted by semantic similarity (PCA-reduced embeddings)
              </CardDescription>
            </div>
            <Select value={selectedCluster} onValueChange={setSelectedCluster}>
              <SelectTrigger className="w-40" data-testid="cluster-filter">
                <SelectValue placeholder="Filter cluster" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                {clusteringResults?.clusters?.map((c) => (
                  <SelectItem key={c.cluster_id} value={c.cluster_id.toString()}>
                    Cluster {c.cluster_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-96 w-full" />
            ) : filteredData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="X" 
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Y" 
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={filteredData} fill="#8884d8">
                    {filteredData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CLUSTER_COLORS[entry.cluster_id % CLUSTER_COLORS.length]} 
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-96 flex-col items-center justify-center text-muted-foreground">
                <Network className="h-12 w-12 mb-4 opacity-50" />
                <p>No data to visualize</p>
                <p className="text-sm">Load a dataset and run clustering first</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cluster Details */}
      {clusteringResults?.clusters && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {clusteringResults.clusters.map((cluster) => (
            <Card 
              key={cluster.cluster_id} 
              className="card-hover cursor-pointer"
              onClick={() => setSelectedCluster(cluster.cluster_id.toString())}
              data-testid={`cluster-card-${cluster.cluster_id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge 
                    style={{ backgroundColor: CLUSTER_COLORS[cluster.cluster_id % CLUSTER_COLORS.length] }}
                    className="text-white"
                  >
                    Cluster {cluster.cluster_id}
                  </Badge>
                  <span className="text-sm font-medium mono">{cluster.size}</span>
                </div>
                <p className="text-sm font-medium mb-2">{cluster.label}</p>
                <div className="flex gap-1 text-xs">
                  <span className="text-green-600">+{cluster.sentiment_breakdown?.positive || 0}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-orange-500">{cluster.sentiment_breakdown?.neutral || 0}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-red-500">-{cluster.sentiment_breakdown?.negative || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cluster Sample Reviews */}
      {clusteringResults?.clusters && selectedCluster !== "all" && (
        <Card data-testid="cluster-samples">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Info className="h-5 w-5" />
              Cluster {selectedCluster} Samples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {clusteringResults.clusters
                  .find(c => c.cluster_id === parseInt(selectedCluster))
                  ?.sample_reviews?.map((review, idx) => (
                    <div key={idx} className="p-3 rounded-sm border border-border text-sm">
                      {review}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

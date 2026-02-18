import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Lightbulb, 
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Download,
  Send
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PriorityBadge = ({ priority }) => {
  const styles = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  };
  
  return (
    <Badge className={styles[priority] || styles.medium}>
      {priority}
    </Badge>
  );
};

export default function Insights() {
  const [insights, setInsights] = useState([]);
  const [recurringIssues, setRecurringIssues] = useState([]);
  const [clusteringResults, setClusteringResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [topics, setTopics] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [insightsRes, clustersRes, topicsRes] = await Promise.all([
        axios.get(`${API}/insights`),
        axios.get(`${API}/clustering/results`),
        axios.get(`${API}/analytics/topics`)
      ]);
      
      setInsights(insightsRes.data.insights || []);
      if (clustersRes.data.clusters) {
        setClusteringResults(clustersRes.data);
      }
      setTopics(topicsRes.data.topics || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateInsight = async (type) => {
    setGenerating(true);
    try {
      let payload = {};
      
      if (type === 'cluster' && selectedCluster) {
        payload.cluster_id = parseInt(selectedCluster);
      } else if (type === 'topic' && selectedTopic) {
        payload.topic = selectedTopic;
      }
      
      const response = await axios.post(`${API}/insights/generate`, payload);
      toast.success("Insight generated successfully!");
      
      // Refresh insights
      const insightsRes = await axios.get(`${API}/insights`);
      setInsights(insightsRes.data.insights || []);
    } catch (error) {
      console.error("Error generating insight:", error);
      toast.error(error.response?.data?.detail || "Failed to generate insight");
    } finally {
      setGenerating(false);
    }
  };

  const findRecurringIssues = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(`${API}/insights/recurring-issues`);
      setRecurringIssues(response.data.issues || []);
      toast.success(`Found ${response.data.issues?.length || 0} recurring issues`);
    } catch (error) {
      console.error("Error finding issues:", error);
      toast.error(error.response?.data?.detail || "Failed to find recurring issues");
    } finally {
      setGenerating(false);
    }
  };

  const sendToSlack = async (insight) => {
    try {
      await axios.post(`${API}/slack/send-alert`, null, {
        params: {
          title: insight.title,
          message: insight.summary.slice(0, 500)
        }
      });
      toast.success("Sent to Slack!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send to Slack");
    }
  };

  return (
    <div className="space-y-8" data-testid="insights-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            AI Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate actionable insights from customer reviews using Claude AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={loading}
            data-testid="refresh-insights-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${API}/export/insights-csv`, '_blank')}
            data-testid="export-insights-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Generation Controls */}
      <Tabs defaultValue="cluster" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="cluster" data-testid="tab-cluster">By Cluster</TabsTrigger>
          <TabsTrigger value="topic" data-testid="tab-topic">By Topic</TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-issues">Recurring Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="cluster">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Sparkles className="h-5 w-5 text-accent" />
                Generate Cluster Insight
              </CardTitle>
              <CardDescription>
                Analyze and summarize reviews in a specific cluster
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                  <SelectTrigger data-testid="cluster-select">
                    <SelectValue placeholder="Select a cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusteringResults?.clusters?.map((c) => (
                      <SelectItem key={c.cluster_id} value={c.cluster_id.toString()}>
                        Cluster {c.cluster_id} - {c.label} ({c.size} reviews)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => generateInsight('cluster')}
                disabled={generating || !selectedCluster}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="generate-cluster-insight-btn"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topic">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Sparkles className="h-5 w-5 text-accent" />
                Generate Topic Insight
              </CardTitle>
              <CardDescription>
                Analyze and summarize reviews for a specific topic
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger data-testid="topic-select">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} ({t.count} reviews)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => generateInsight('topic')}
                disabled={generating || !selectedTopic}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="generate-topic-insight-btn"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Find Recurring Issues
              </CardTitle>
              <CardDescription>
                Identify and summarize recurring complaints from negative reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={findRecurringIssues}
                disabled={generating}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                data-testid="find-issues-btn"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Find Issues
              </Button>
            </CardContent>
          </Card>

          {/* Recurring Issues Results */}
          {recurringIssues.length > 0 && (
            <div className="mt-6 space-y-4">
              {recurringIssues.map((issue, idx) => (
                <Card key={idx} className="border-l-4 border-l-destructive" data-testid={`issue-card-${idx}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h4 className="font-semibold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {issue.topic}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {issue.count} complaints across {issue.products_affected?.length || 0} products
                        </p>
                      </div>
                      <Badge variant="destructive">{issue.count} issues</Badge>
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{issue.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {issue.products_affected?.slice(0, 5).map((product, pidx) => (
                        <Badge key={pidx} variant="outline" className="text-xs">
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Generated Insights */}
      <Card data-testid="insights-list">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Lightbulb className="h-5 w-5" />
            Generated Insights
          </CardTitle>
          <CardDescription>
            AI-generated summaries and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : insights.length > 0 ? (
              <div className="space-y-4">
                {insights.map((insight, idx) => (
                  <Card key={insight.id || idx} className="card-hover" data-testid={`insight-card-${idx}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h4 className="font-semibold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {insight.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {insight.affected_reviews} reviews analyzed
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={insight.priority} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendToSlack(insight)}
                            title="Send to Slack"
                            data-testid={`send-slack-${idx}`}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {insight.summary}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline">{insight.category}</Badge>
                        <span className="text-xs text-muted-foreground mono">
                          {new Date(insight.created_at).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">No insights generated yet</p>
                <p className="text-sm">Select a cluster or topic above to generate insights</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

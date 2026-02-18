import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Star,
  RefreshCw,
  Download,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { useNavigate } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ["#10B981", "#F97316", "#6B7280"];

const MetricCard = ({ title, value, icon: Icon, trend, loading }) => (
  <Card className="card-hover" data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {title}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-3xl font-bold tracking-tight metric-value">{value}</p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-secondary">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
      {trend && !loading && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          {trend > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : trend < 0 ? (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ) : (
            <Minus className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"}>
            {Math.abs(trend)}% from last period
          </span>
        </div>
      )}
    </CardContent>
  </Card>
);

const SentimentBadge = ({ sentiment }) => {
  const styles = {
    positive: "sentiment-positive",
    negative: "sentiment-negative",
    neutral: "sentiment-neutral"
  };
  
  return (
    <Badge variant="outline" className={styles[sentiment] || styles.neutral}>
      {sentiment}
    </Badge>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Card className="border shadow-lg">
        <CardContent className="p-3">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground mono">
            {payload[0].value} reviews
          </p>
        </CardContent>
      </Card>
    );
  }
  return null;
};

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [topics, setTopics] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, topicsRes, reviewsRes] = await Promise.all([
        axios.get(`${API}/analytics/overview`),
        axios.get(`${API}/analytics/topics`),
        axios.get(`${API}/reviews?limit=5`)
      ]);
      
      setAnalytics(analyticsRes.data);
      setTopics(topicsRes.data.topics || []);
      setRecentReviews(reviewsRes.data.reviews || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sentimentData = analytics?.sentiment_distribution
    ? [
        { name: "Positive", value: analytics.sentiment_distribution.positive || 0, color: "#10B981" },
        { name: "Neutral", value: analytics.sentiment_distribution.neutral || 0, color: "#F97316" },
        { name: "Negative", value: analytics.sentiment_distribution.negative || 0, color: "#EF4444" }
      ]
    : [];

  const topicChartData = topics.slice(0, 8).map(t => ({
    name: t.name.length > 15 ? t.name.slice(0, 15) + "..." : t.name,
    count: t.count,
    fullName: t.name
  }));

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of customer review insights and analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            data-testid="refresh-btn"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${API}/export/csv`, '_blank')}
            data-testid="export-csv-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Reviews"
          value={analytics?.total_reviews?.toLocaleString() || "0"}
          icon={MessageSquare}
          loading={loading}
        />
        <MetricCard
          title="Avg Rating"
          value={analytics?.average_rating ? `${analytics.average_rating}/5` : "0/5"}
          icon={Star}
          loading={loading}
        />
        <MetricCard
          title="Positive"
          value={analytics?.sentiment_distribution?.positive?.toLocaleString() || "0"}
          icon={TrendingUp}
          loading={loading}
        />
        <MetricCard
          title="Negative"
          value={analytics?.sentiment_distribution?.negative?.toLocaleString() || "0"}
          icon={TrendingDown}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Topic Distribution */}
        <Card className="lg:col-span-2" data-testid="topic-chart">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Topic Distribution
            </CardTitle>
            <CardDescription>
              Reviews categorized by topic
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : topicChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topicChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120} 
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No data available. Load a dataset first.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card data-testid="sentiment-chart">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Sentiment
            </CardTitle>
            <CardDescription>
              Overall sentiment breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : sentimentData.some(d => d.value > 0) ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {sentimentData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div 
                        className="h-3 w-3 rounded-sm" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium mono">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No sentiment data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reviews & Top Products */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Reviews */}
        <Card data-testid="recent-reviews">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Recent Reviews
              </CardTitle>
              <CardDescription>
                Latest customer feedback
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/search')}
              data-testid="view-all-reviews-btn"
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : recentReviews.length > 0 ? (
                <div className="space-y-4">
                  {recentReviews.map((review) => (
                    <div
                      key={review.id}
                      className="p-3 rounded-sm border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium truncate flex-1">
                          {review.product_name || "Unknown Product"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-accent text-accent" />
                          <span className="text-xs mono">{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {review.review_text}
                      </p>
                      <div className="flex gap-2">
                        <SentimentBadge sentiment={review.sentiment} />
                        <Badge variant="outline" className="text-xs">
                          {review.topic}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  No reviews yet. Load a dataset to get started.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card data-testid="top-products">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Top Products
            </CardTitle>
            <CardDescription>
              Products with most reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : analytics?.top_products?.length > 0 ? (
                <div className="space-y-3">
                  {analytics.top_products.map((product, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-sm border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-secondary text-sm font-medium mono">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[180px]">
                          {product.product}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-accent text-accent" />
                          <span className="text-xs mono">{product.avg_rating}</span>
                        </div>
                        <Badge variant="secondary" className="mono">
                          {product.reviews}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  No product data available
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Settings as SettingsIcon, 
  Slack,
  Download,
  FileText,
  Save,
  Loader2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [slackConfig, setSlackConfig] = useState({ webhook_url: "", enabled: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSlackConfig();
  }, []);

  const fetchSlackConfig = async () => {
    try {
      const response = await axios.get(`${API}/slack/config`);
      if (response.data) {
        setSlackConfig({
          webhook_url: response.data.webhook_url || "",
          enabled: response.data.enabled || false
        });
      }
    } catch (error) {
      console.error("Error fetching Slack config:", error);
    }
  };

  const saveSlackConfig = async () => {
    if (!slackConfig.webhook_url.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/slack/configure`, slackConfig);
      toast.success("Slack configuration saved!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(error.response?.data?.detail || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const testSlackConnection = async () => {
    if (!slackConfig.webhook_url.trim()) {
      toast.error("Please enter a webhook URL first");
      return;
    }

    setTesting(true);
    try {
      await axios.post(`${API}/slack/send-alert`, null, {
        params: {
          title: "Test Alert",
          message: "This is a test message from ReviewSense AI. If you see this, your Slack integration is working!"
        }
      });
      toast.success("Test message sent! Check your Slack channel.");
    } catch (error) {
      console.error("Test failed:", error);
      toast.error(error.response?.data?.detail || "Failed to send test message");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure integrations and export options
        </p>
      </div>

      {/* Slack Integration */}
      <Card data-testid="slack-settings">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Slack className="h-5 w-5" />
            Slack Integration
          </CardTitle>
          <CardDescription>
            Connect to Slack to receive insight alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="slack-enabled">Enable Slack Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts when new insights are generated
              </p>
            </div>
            <Switch
              id="slack-enabled"
              checked={slackConfig.enabled}
              onCheckedChange={(checked) => setSlackConfig({ ...slackConfig, enabled: checked })}
              data-testid="slack-enabled-switch"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackConfig.webhook_url}
              onChange={(e) => setSlackConfig({ ...slackConfig, webhook_url: e.target.value })}
              data-testid="webhook-url-input"
            />
            <p className="text-xs text-muted-foreground">
              Create an incoming webhook in your Slack workspace settings
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={saveSlackConfig}
              disabled={saving}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid="save-slack-btn"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
            <Button 
              variant="outline"
              onClick={testSlackConnection}
              disabled={testing}
              data-testid="test-slack-btn"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Slack className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card data-testid="export-settings">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Download className="h-5 w-5" />
            Export Options
          </CardTitle>
          <CardDescription>
            Download your data in various formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => window.open(`${API}/export/csv`, '_blank')}
              data-testid="export-reviews-csv-btn"
            >
              <FileText className="h-6 w-6" />
              <span>Export Reviews (CSV)</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => window.open(`${API}/export/insights-csv`, '_blank')}
              data-testid="export-insights-csv-btn"
            >
              <FileText className="h-6 w-6" />
              <span>Export Insights (CSV)</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => window.open(`${API}/export/pdf`, '_blank')}
              data-testid="export-pdf-btn"
            >
              <FileText className="h-6 w-6" />
              <span>Analytics Report (PDF)</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How to Use Section */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            How to Use ReviewSense AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">1. Load Your Data</h4>
              <p className="text-sm text-muted-foreground">
                Go to Datasets page and upload your CSV file with customer reviews, or load the sample data to explore the platform.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. Run Clustering</h4>
              <p className="text-sm text-muted-foreground">
                Navigate to Topic Explorer and run K-means clustering to group semantically similar reviews.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Generate Insights</h4>
              <p className="text-sm text-muted-foreground">
                Use the Insights page to generate AI-powered summaries by cluster, topic, or to find recurring issues.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">4. Search & Export</h4>
              <p className="text-sm text-muted-foreground">
                Use semantic search to find specific feedback, then export your findings to CSV/PDF or send alerts to Slack.
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-2">
            <h4 className="font-medium">Business Applications</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Product Teams:</strong> Identify feature requests and pain points to prioritize roadmap</li>
              <li><strong>Customer Success:</strong> Track recurring issues and proactively address customer concerns</li>
              <li><strong>Marketing:</strong> Discover positive themes for testimonials and messaging</li>
              <li><strong>Support:</strong> Auto-categorize tickets and route to appropriate teams</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-sm bg-secondary/50">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-sm">Sentence Transformers</p>
                <p className="text-xs text-muted-foreground">Local embeddings ready</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-sm bg-secondary/50">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-sm">Claude AI</p>
                <p className="text-xs text-muted-foreground">Summarization enabled</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-sm bg-secondary/50">
              {slackConfig.enabled && slackConfig.webhook_url ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Slack</p>
                    <p className="text-xs text-muted-foreground">Connected</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Slack</p>
                    <p className="text-xs text-muted-foreground">Not configured</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

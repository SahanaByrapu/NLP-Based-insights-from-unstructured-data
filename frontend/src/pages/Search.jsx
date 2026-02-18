import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search as SearchIcon, 
  Star,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [topK, setTopK] = useState([10]);
  const [totalSearched, setTotalSearched] = useState(0);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setSearching(true);
    try {
      const response = await axios.post(`${API}/search`, {
        query: query.trim(),
        top_k: topK[0],
        use_openai: false
      });
      
      setResults(response.data.results || []);
      setTotalSearched(response.data.total_searched || 0);
      
      if (response.data.results?.length === 0) {
        toast.info("No matching reviews found");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error.response?.data?.detail || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-8" data-testid="search-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Semantic Search
        </h1>
        <p className="text-muted-foreground mt-1">
          Find reviews using natural language queries powered by sentence embeddings
        </p>
      </div>

      {/* Search Controls */}
      <Card data-testid="search-controls">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search-query">Search Query</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-query"
                  placeholder="e.g., battery problems, comfortable for long hours, bluetooth issues..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            <div className="w-48 space-y-2">
              <Label>Results: <span className="mono font-medium">{topK[0]}</span></Label>
              <Slider
                value={topK}
                onValueChange={setTopK}
                min={5}
                max={50}
                step={5}
                data-testid="results-slider"
              />
            </div>
            
            <Button 
              onClick={handleSearch} 
              disabled={searching}
              className="bg-accent hover:bg-accent/90 text-accent-foreground min-w-32"
              data-testid="search-btn"
            >
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {totalSearched > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              Searched across <span className="mono font-medium">{totalSearched.toLocaleString()}</span> reviews
            </p>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card data-testid="search-results">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Search Results
            </CardTitle>
            <CardDescription>
              Found {results.length} semantically similar reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {results.map((result, idx) => (
                  <div
                    key={result.id}
                    className="p-4 rounded-sm border border-border hover:bg-muted/50 transition-colors"
                    data-testid={`search-result-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground mono">#{idx + 1}</span>
                          <span className="font-medium">
                            {result.product_name || "Unknown Product"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-accent text-accent" />
                            <span className="text-xs mono">{result.rating}</span>
                          </div>
                          <SentimentBadge sentiment={result.sentiment} />
                          <Badge variant="outline" className="text-xs">
                            {result.topic}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Similarity</p>
                        <p className="text-lg font-semibold mono text-accent">
                          {(result.similarity_score * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.review_text}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {results.length === 0 && !searching && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <SearchIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Search Reviews
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              Enter a natural language query to find semantically similar reviews. 
              Try queries like "battery drains fast" or "comfortable for extended use".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

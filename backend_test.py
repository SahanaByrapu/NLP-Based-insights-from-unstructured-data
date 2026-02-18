import requests
import sys
import json
from datetime import datetime

class ReviewSenseAPITester:
    def __init__(self, base_url="https://feedback-classifier.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                # Print response for successful tests to verify data
                if response.status_code == 200 and method == 'GET':
                    try:
                        resp_data = response.json()
                        if isinstance(resp_data, dict):
                            print(f"   Response keys: {list(resp_data.keys())}")
                        elif isinstance(resp_data, list):
                            print(f"   Response: List with {len(resp_data)} items")
                    except:
                        print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def test_health_endpoints(self):
        """Test basic health and root endpoints"""
        print("\n" + "="*50)
        print("TESTING BASIC HEALTH ENDPOINTS")
        print("="*50)
        
        self.run_test("Root Endpoint", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_sample_data_loading(self):
        """Test sample data loading"""
        print("\n" + "="*50)
        print("TESTING SAMPLE DATA LOADING")
        print("="*50)
        
        success, response = self.run_test("Load Sample Dataset", "POST", "datasets/sample", 200)
        return success

    def test_analytics_endpoints(self):
        """Test analytics and overview endpoints"""
        print("\n" + "="*50)
        print("TESTING ANALYTICS ENDPOINTS")
        print("="*50)
        
        self.run_test("Analytics Overview", "GET", "analytics/overview", 200)
        self.run_test("Topic Analytics", "GET", "analytics/topics", 200)
        self.run_test("Get Reviews", "GET", "reviews?limit=5", 200)
        self.run_test("Get Datasets", "GET", "datasets", 200)

    def test_clustering_endpoints(self):
        """Test clustering functionality"""
        print("\n" + "="*50)
        print("TESTING CLUSTERING ENDPOINTS")
        print("="*50)
        
        # Run clustering
        success, response = self.run_test("Run Clustering", "POST", "clustering/run?n_clusters=5", 200)
        
        if success:
            # Test clustering results
            self.run_test("Get Clustering Results", "GET", "clustering/results", 200)
            self.run_test("Get Scatter Data", "GET", "clustering/scatter-data", 200)
        
        return success

    def test_search_endpoints(self):
        """Test semantic search"""
        print("\n" + "="*50)
        print("TESTING SEARCH ENDPOINTS")
        print("="*50)
        
        search_data = {
            "query": "battery problems",
            "top_k": 5,
            "use_openai": False
        }
        
        self.run_test("Semantic Search", "POST", "search", 200, search_data)

    def test_insights_endpoints(self):
        """Test insights generation"""
        print("\n" + "="*50)
        print("TESTING INSIGHTS ENDPOINTS")
        print("="*50)
        
        # Test basic insights retrieval
        self.run_test("Get Insights", "GET", "insights", 200)
        
        # Test recurring issues
        self.run_test("Find Recurring Issues", "POST", "insights/recurring-issues", 200)
        
        # Test insight generation for general reviews
        insight_data = {}
        self.run_test("Generate General Insight", "POST", "insights/generate", 200, insight_data)

    def test_export_endpoints(self):
        """Test export functionality"""
        print("\n" + "="*50)
        print("TESTING EXPORT ENDPOINTS")
        print("="*50)
        
        self.run_test("Export Reviews CSV", "GET", "export/csv", 200)
        self.run_test("Export Insights CSV", "GET", "export/insights-csv", 200)
        self.run_test("Export PDF Report", "GET", "export/pdf", 200)

    def test_slack_endpoints(self):
        """Test Slack configuration endpoints"""
        print("\n" + "="*50)
        print("TESTING SLACK ENDPOINTS")
        print("="*50)
        
        # Test get config (should work even if not configured)
        self.run_test("Get Slack Config", "GET", "slack/config", 200)
        
        # Test configure slack
        slack_config = {
            "webhook_url": "https://hooks.slack.com/services/test",
            "enabled": True
        }
        self.run_test("Configure Slack", "POST", "slack/configure", 200, slack_config)

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"📊 Tests Run: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {len(self.failed_tests)}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['name']}")
                if 'error' in test:
                    print(f"   Error: {test['error']}")
                else:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
                    if 'response' in test:
                        print(f"   Response: {test['response']}")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting ReviewSense AI API Tests")
    print(f"🕒 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = ReviewSenseAPITester()
    
    # Run tests in logical order
    tester.test_health_endpoints()
    
    # Load sample data first (required for other tests)
    data_loaded = tester.test_sample_data_loading()
    
    # Basic analytics (should work after data loading)
    tester.test_analytics_endpoints()
    
    # Clustering (requires data)
    if data_loaded:
        clustering_done = tester.test_clustering_endpoints()
    
    # Search (requires data and embeddings)
    if data_loaded:
        tester.test_search_endpoints()
    
    # Insights (works better with clustering done)
    if data_loaded:
        tester.test_insights_endpoints()
    
    # Export tests
    tester.test_export_endpoints()
    
    # Slack configuration
    tester.test_slack_endpoints()
    
    # Print final summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
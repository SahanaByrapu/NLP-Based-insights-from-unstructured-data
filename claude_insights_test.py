import requests
import sys
import json
import time
from datetime import datetime

class ClaudeInsightsAPITester:
    def __init__(self, base_url="http://localhost:8001/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                # Print response for successful tests to verify data
                try:
                    resp_data = response.json()
                    if isinstance(resp_data, dict):
                        print(f"   Response keys: {list(resp_data.keys())}")
                        # For insights, show summary preview
                        if 'summary' in resp_data:
                            summary_preview = resp_data['summary'][:100] + "..." if len(resp_data['summary']) > 100 else resp_data['summary']
                            print(f"   Summary preview: {summary_preview}")
                        if 'issues' in resp_data and isinstance(resp_data['issues'], list):
                            print(f"   Issues found: {len(resp_data['issues'])}")
                    elif isinstance(resp_data, list):
                        print(f"   Response: List with {len(resp_data)} items")
                except Exception as e:
                    print(f"   Response parsing error: {e}")
                    print(f"   Raw response: {response.text[:100]}...")
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

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out after {timeout} seconds")
            self.failed_tests.append({
                'name': name,
                'error': f'Timeout after {timeout} seconds'
            })
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def test_health_and_setup(self):
        """Test basic health and verify data exists"""
        print("\n" + "="*50)
        print("TESTING HEALTH & DATA SETUP")
        print("="*50)
        
        # Health check
        success, _ = self.run_test("Health Check", "GET", "health", 200)
        if not success:
            return False
        
        # Verify sample data exists
        success, reviews_response = self.run_test("Check Reviews Exist", "GET", "reviews?limit=5", 200)
        if not success or not reviews_response.get('reviews'):
            print("❌ No reviews found - need to load sample data first")
            # Try to load sample data
            success, _ = self.run_test("Load Sample Data", "POST", "datasets/sample", 200)
            if not success:
                return False
            
            # Wait a bit for processing
            time.sleep(2)
            
            # Verify again
            success, reviews_response = self.run_test("Verify Reviews After Loading", "GET", "reviews?limit=5", 200)
            if not success:
                return False
        
        print(f"✅ Found {reviews_response.get('total', 0)} reviews in system")
        
        # Check if clustering exists, if not create it
        success, clustering_response = self.run_test("Check Clustering Results", "GET", "clustering/results", 200)
        if not success or 'clusters' not in clustering_response:
            print("⚠️  No clustering results found - creating clusters")
            success, _ = self.run_test("Run Clustering", "POST", "clustering/run?n_clusters=5", 200)
            if not success:
                return False
            
            # Wait for clustering to complete
            time.sleep(3)
            
            # Verify clustering
            success, clustering_response = self.run_test("Verify Clustering Results", "GET", "clustering/results", 200)
            if not success:
                return False
        
        print(f"✅ Found {len(clustering_response.get('clusters', []))} clusters")
        return True

    def test_claude_insights_generation(self):
        """Test Claude AI insights generation functionality"""
        print("\n" + "="*50)
        print("TESTING CLAUDE AI INSIGHTS GENERATION")
        print("="*50)
        
        # Test 1: Generate insight for cluster_id
        print("\n📋 Test 1: Generate insight for cluster_id=0")
        insight_data_cluster = {"cluster_id": 0}
        success1, response1 = self.run_test(
            "Generate Insight for Cluster 0", 
            "POST", 
            "insights/generate", 
            200, 
            insight_data_cluster,
            timeout=30
        )
        
        # Test 2: Generate insight for topic
        print("\n📋 Test 2: Generate insight for topic")
        insight_data_topic = {"topic": "Battery & Power"}
        success2, response2 = self.run_test(
            "Generate Insight for Battery Topic", 
            "POST", 
            "insights/generate", 
            200, 
            insight_data_topic,
            timeout=30
        )
        
        # Test 3: Generate general insight (no parameters)
        print("\n📋 Test 3: Generate general insight")
        insight_data_general = {}
        success3, response3 = self.run_test(
            "Generate General Insight", 
            "POST", 
            "insights/generate", 
            200, 
            insight_data_general,
            timeout=30
        )
        
        # Test 4: Generate insight for specific review IDs
        # First get some review IDs
        success_reviews, reviews_response = self.run_test("Get Sample Review IDs", "GET", "reviews?limit=3", 200)
        if success_reviews and reviews_response.get('reviews'):
            review_ids = [r['id'] for r in reviews_response['reviews'][:2]]
            print(f"\n📋 Test 4: Generate insight for specific review IDs: {review_ids}")
            insight_data_ids = {"review_ids": review_ids}
            success4, response4 = self.run_test(
                "Generate Insight for Specific Reviews", 
                "POST", 
                "insights/generate", 
                200, 
                insight_data_ids,
                timeout=30
            )
        else:
            print("⚠️  Skipping specific review IDs test - couldn't get review IDs")
            success4 = False
        
        # Count successful tests
        successful_tests = sum([success1, success2, success3, success4])
        print(f"\n📊 Claude Insights Generation Results: {successful_tests}/4 tests passed")
        
        return successful_tests >= 3  # At least 3/4 should work

    def test_recurring_issues_detection(self):
        """Test recurring issues detection"""
        print("\n" + "="*50)
        print("TESTING RECURRING ISSUES DETECTION")
        print("="*50)
        
        success, response = self.run_test(
            "Detect Recurring Issues", 
            "POST", 
            "insights/recurring-issues", 
            200,
            timeout=30
        )
        
        if success:
            issues_count = len(response.get('issues', []))
            total_negative = response.get('total_negative_reviews', 0)
            print(f"✅ Recurring Issues Analysis Complete:")
            print(f"   - Found {issues_count} recurring issue patterns")
            print(f"   - Analyzed {total_negative} negative reviews")
            
            if issues_count > 0:
                print("   - Sample issues:")
                for i, issue in enumerate(response['issues'][:3], 1):
                    print(f"     {i}. {issue.get('topic', 'Unknown Topic')}: {issue.get('count', 0)} occurrences")
        
        return success

    def test_insights_retrieval(self):
        """Test insights retrieval after generation"""
        print("\n" + "="*50)
        print("TESTING INSIGHTS RETRIEVAL")
        print("="*50)
        
        success, response = self.run_test("Get Generated Insights", "GET", "insights?limit=10", 200)
        
        if success:
            insights = response.get('insights', [])
            print(f"✅ Retrieved {len(insights)} insights")
            
            if insights:
                print("   Recent insights:")
                for i, insight in enumerate(insights[:3], 1):
                    title = insight.get('title', 'No Title')[:50]
                    category = insight.get('category', 'Unknown')
                    print(f"     {i}. {title} ({category})")
        
        return success

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("CLAUDE AI INSIGHTS TEST SUMMARY")
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
    print("🚀 Starting Claude AI Insights Focused Tests")
    print(f"🕒 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🎯 Focus: Testing Claude AI summarization functionality")
    print("🌐 Backend URL: http://localhost:8001/api")
    
    tester = ClaudeInsightsAPITester()
    
    # Step 1: Verify health and data setup
    if not tester.test_health_and_setup():
        print("\n❌ CRITICAL: Health check or data setup failed. Cannot proceed with Claude AI tests.")
        return 1
    
    # Step 2: Test Claude AI insights generation (main focus)
    claude_success = tester.test_claude_insights_generation()
    
    # Step 3: Test recurring issues detection
    recurring_success = tester.test_recurring_issues_detection()
    
    # Step 4: Test insights retrieval
    retrieval_success = tester.test_insights_retrieval()
    
    # Print final summary
    all_success = tester.print_summary()
    
    # Special analysis for Claude AI functionality
    print("\n" + "="*60)
    print("CLAUDE AI FUNCTIONALITY ANALYSIS")
    print("="*60)
    
    if claude_success:
        print("✅ Claude AI Insights Generation: WORKING")
    else:
        print("❌ Claude AI Insights Generation: FAILING")
    
    if recurring_success:
        print("✅ Recurring Issues Detection: WORKING")
    else:
        print("❌ Recurring Issues Detection: FAILING")
    
    if retrieval_success:
        print("✅ Insights Retrieval: WORKING")
    else:
        print("❌ Insights Retrieval: FAILING")
    
    # Overall Claude functionality assessment
    claude_functionality_working = claude_success and recurring_success and retrieval_success
    
    print(f"\n🎯 CLAUDE AI OVERALL STATUS: {'✅ FUNCTIONAL' if claude_functionality_working else '❌ NEEDS FIXING'}")
    
    return 0 if claude_functionality_working else 1

if __name__ == "__main__":
    sys.exit(main())
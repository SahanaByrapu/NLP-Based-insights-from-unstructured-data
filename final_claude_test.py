import requests
import sys
import json
import time
from datetime import datetime

class FinalClaudeAPITester:
    def __init__(self, base_url="http://localhost:8001/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, timeout=45):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            start_time = time.time()
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            end_time = time.time()

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code} ({end_time-start_time:.1f}s)")
                
                # Show key response data
                try:
                    resp_data = response.json()
                    if 'summary' in resp_data:
                        summary_preview = resp_data['summary'][:150] + "..." if len(resp_data['summary']) > 150 else resp_data['summary']
                        print(f"   Summary: {summary_preview}")
                    elif 'issues' in resp_data and isinstance(resp_data['issues'], list):
                        print(f"   Found {len(resp_data['issues'])} recurring issues")
                        for issue in resp_data['issues'][:2]:
                            print(f"     - {issue.get('topic', 'Unknown')}: {issue.get('count', 0)} occurrences")
                    elif 'insights' in resp_data:
                        print(f"   Retrieved {len(resp_data['insights'])} insights")
                except:
                    print(f"   Response received successfully")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })

            return success, response.json() if success and response.text else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out after {timeout} seconds")
            self.failed_tests.append({'name': name, 'error': f'Timeout after {timeout} seconds'})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({'name': name, 'error': str(e)})
            return False, {}

def main():
    print("🎯 FINAL CLAUDE AI FUNCTIONALITY TEST")
    print(f"🕒 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    tester = FinalClaudeAPITester()
    
    # Test all Claude AI functionality requested
    print("\n📋 TESTING CLAUDE AI INSIGHTS GENERATION")
    
    # Test 1: Generate insight with cluster_id
    success1, _ = tester.run_test(
        "Claude Insight Generation (cluster_id)", 
        "POST", 
        "insights/generate", 
        200, 
        {"cluster_id": 1}
    )
    
    # Test 2: Generate insight with topic
    success2, _ = tester.run_test(
        "Claude Insight Generation (topic)", 
        "POST", 
        "insights/generate", 
        200, 
        {"topic": "Connectivity Issues"}
    )
    
    # Test 3: Recurring issues detection
    print("\n📋 TESTING RECURRING ISSUES DETECTION")
    success3, _ = tester.run_test(
        "Claude Recurring Issues Detection", 
        "POST", 
        "insights/recurring-issues", 
        200,
        timeout=45
    )
    
    # Test 4: Retrieve insights
    print("\n📋 TESTING INSIGHTS RETRIEVAL")
    success4, _ = tester.run_test(
        "Get Generated Insights", 
        "GET", 
        "insights", 
        200
    )
    
    # Summary
    print("\n" + "="*60)
    print("FINAL TEST RESULTS")
    print("="*60)
    print(f"📊 Tests Run: {tester.tests_run}")
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {len(tester.failed_tests)}")
    print(f"📈 Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    # Feature-specific results
    print("\n🎯 FEATURE STATUS:")
    print(f"✅ Claude AI insights generation (cluster_id): {'WORKING' if success1 else 'FAILED'}")
    print(f"✅ Claude AI insights generation (topic): {'WORKING' if success2 else 'FAILED'}")  
    print(f"✅ Recurring issues detection: {'WORKING' if success3 else 'FAILED'}")
    print(f"✅ Insights page data retrieval: {'WORKING' if success4 else 'FAILED'}")
    
    # Overall assessment
    all_working = success1 and success2 and success3 and success4
    print(f"\n🏆 OVERALL CLAUDE AI STATUS: {'🎉 FULLY FUNCTIONAL' if all_working else '⚠️ PARTIALLY WORKING'}")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for test in tester.failed_tests:
            print(f"  - {test['name']}: {test.get('error', 'Status code mismatch')}")
    
    return 0 if all_working else 1

if __name__ == "__main__":
    sys.exit(main())
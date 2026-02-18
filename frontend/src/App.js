import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import Dashboard from "@/pages/Dashboard";
import TopicExplorer from "@/pages/TopicExplorer";
import Search from "@/pages/Search";
import Insights from "@/pages/Insights";
import DatasetManagement from "@/pages/DatasetManagement";
import Settings from "@/pages/Settings";
import Layout from "@/components/Layout";

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="topics" element={<TopicExplorer />} />
            <Route path="search" element={<Search />} />
            <Route path="insights" element={<Insights />} />
            <Route path="datasets" element={<DatasetManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;

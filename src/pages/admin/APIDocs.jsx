import React, { useState } from "react";
import { 
  Book, Code, Terminal, Shield, CheckCircle, 
  Info, Copy, Laptop, Smartphone, Database, 
  AlertCircle, ChevronRight, Activity, Globe,
  FileText, Download
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function APIDocs() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("curl");

  // APX-102: Use production URL for documentation if on localhost
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const baseUrl = isLocal ? "https://apexaccreditpro.com" : window.location.origin;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  const downloadGuide = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(22);
    doc.setTextColor(0, 188, 212); // Cyan
    doc.text("Apex Partner API Integration Guide", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Version: 1.0.0 | Generated: ${new Date().toLocaleDateString()} | Base URL: ${baseUrl}`, 20, 28);
    
    // Overview
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("1. Overview", 20, 45);
    doc.setFontSize(11);
    doc.text("The Apex Partner API allows authorized third-party systems to verify athlete", 20, 52);
    doc.text("accreditations in real-time. This guide provides technical specifications for", 20, 57);
    doc.text("integrating kiosks, medical apps, and gate access controllers.", 20, 62);
    
    // Authentication Table
    doc.setFontSize(16);
    doc.text("2. Authentication", 20, 80);
    doc.autoTable({
      startY: 85,
      head: [['Header', 'Value', 'Description']],
      body: [
        ['Content-Type', 'application/json', 'Required for all requests'],
        ['x-api-key', 'YOUR_API_KEY', 'Your unique secret key']
      ],
      headStyles: { fillColor: [0, 188, 212] }
    });
    
    // Endpoint
    const finalY = doc.lastAutoTable.finalY || 110;
    doc.setFontSize(16);
    doc.text("3. Endpoint: Verify Badge", 20, finalY + 15);
    doc.setFontSize(11);
    doc.text(`POST: ${baseUrl}/api/v1/verify`, 20, finalY + 22);
    
    // Field Reference Table
    doc.setFontSize(16);
    doc.text("4. Field Reference", 20, finalY + 40);
    doc.autoTable({
      startY: finalY + 45,
      head: [['Field', 'Description', 'Example']],
      body: [
        ['firstName', "Athlete's first name", 'Fatma'],
        ['lastName', "Athlete's last name", 'Abdullah'],
        ['role', 'Category', 'Athlete'],
        ['badgeNumber', 'Unique ID', 'ATH-155'],
        ['club', 'Sports Org', 'Dubai Swimming Club'],
        ['nationality', 'Country', 'UAE'],
        ['status', 'Current State', 'approved']
      ],
      headStyles: { fillColor: [0, 188, 212] }
    });

    // Error Codes
    const errorY = doc.lastAutoTable.finalY || 200;
    doc.setFontSize(16);
    doc.text("5. Error Handling", 20, errorY + 15);
    doc.autoTable({
      startY: errorY + 20,
      head: [['Status', 'Error Message', 'Reason']],
      body: [
        ['400', 'badgeId is required', 'Missing payload'],
        ['401', 'API Key is required', 'Missing header'],
        ['403', 'Invalid/Revoked Key', 'Key not active'],
        ['404', 'Not Found', 'ID does not exist']
      ],
      headStyles: { fillColor: [244, 63, 94] } // Red
    });
    
    doc.save("Apex_API_Integration_Guide.pdf");
    toast.success("Professional PDF Guide Downloaded");
  };

  const codeExamples = {
    curl: `curl -X POST ${baseUrl}/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"badgeId": "ATH-155"}'`,
    
    javascript: `const verifyBadge = async (badgeId) => {
  const response = await fetch('${baseUrl}/api/v1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({ badgeId })
  });

  const data = await response.json();
  if (data.success) {
    console.log('Verified:', data.data);
  } else {
    console.error('Error:', data.error);
  }
};`,

    python: `import requests

url = "${baseUrl}/api/v1/verify"
headers = {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {"badgeId": "ATH-155"}

response = requests.post(url, json=payload, headers=headers)
data = response.json()

if data["success"]:
    print(f"Partner: {data['partner']}")
    print(f"Athlete: {data['data']['firstName']} {data['data']['lastName']}")
else:
    print(f"Error: {data['error']}")`
  };

  const responseExample = `{
  "success": true,
  "partner": "Acme Kiosk Solutions",
  "data": {
    "firstName": "Fatma",
    "lastName": "Abdullah",
    "role": "Athlete",
    "badgeNumber": "ATH-155",
    "club": "Dubai Swimming Club",
    "photoUrl": "https://...",
    "status": "approved"
  }
}`;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-cyan-500/10 rounded-2xl">
            <Book className="w-10 h-10 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              Partner API Documentation
            </h1>
            <p className="text-slate-400 text-lg">V1.0.0 — Build secure integrations with the Apex Platform.</p>
          </div>
        </div>
        <button 
          onClick={downloadGuide}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm font-bold"
        >
          <FileText className="w-4 h-4" /> Download PDF Guide
        </button>
      </div>

      <div id="api_docs_content" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2 sticky top-6 self-start">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-4">Documentation</h3>
          <a href="#overview" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-all">
            <Globe className="w-4 h-4" /> Overview
          </a>
          <a href="#integration" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-all">
            <Activity className="w-4 h-4" /> Integration Workflow
          </a>
          <a href="#authentication" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-all">
            <Shield className="w-4 h-4" /> Authentication
          </a>
          <a href="#endpoint" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-all">
            <Terminal className="w-4 h-4" /> Verify Badge
          </a>
          <a href="#fields" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-all">
            <Database className="w-4 h-4" /> Field Reference
          </a>
          <a href="#errors" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 transition-all">
            <AlertCircle className="w-4 h-4" /> Error Handling
          </a>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-12">
          
          {/* Overview Section */}
          <section id="overview" className="scroll-mt-10">
            <h2 className="text-2xl font-bold text-white mb-6">Overview</h2>
            <div className="prose prose-invert max-w-none text-slate-300 space-y-4">
              <p>
                The Apex Partner API allows authorized third-party systems (such as medical centers, event kiosks, and gate access controllers) 
                to verify athlete accreditations in real-time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-800/30 border border-slate-700 p-6 rounded-2xl">
                  <Laptop className="w-6 h-6 text-cyan-400 mb-3" />
                  <h4 className="text-white font-bold mb-2">Self-Service Kiosks</h4>
                  <p className="text-sm text-slate-400">Enable athletes to scan their QR codes to print badges or check entry status at event venues.</p>
                </div>
                <div className="bg-slate-800/30 border border-slate-700 p-6 rounded-2xl">
                  <Smartphone className="w-6 h-6 text-emerald-400 mb-3" />
                  <h4 className="text-white font-bold mb-2">Partner Apps</h4>
                  <p className="text-sm text-slate-400">Verify athlete eligibility at medical check-ins or equipment collection points.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Integration Workflow */}
          <section id="integration" className="scroll-mt-10">
            <h2 className="text-2xl font-bold text-white mb-6">Integration Workflow</h2>
            <div className="space-y-6">
              {[
                { step: "01", title: "Partner Registration", desc: "Contact the Apex Admin to have your partner organization registered in the platform." },
                { step: "02", title: "API Key Generation", desc: "The Admin will generate a unique 'apex_live' key and allocate specific data fields (e.g. Photo, Role) that your system is allowed to see." },
                { step: "03", title: "Implementation", desc: "Use the provided API Key to make POST requests to our secure verification endpoint." }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <span className="text-4xl font-black text-slate-800 leading-none">{item.step}</span>
                  <div>
                    <h4 className="text-white font-bold mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Authentication Section */}
          <section id="authentication" className="bg-slate-800/50 rounded-3xl border border-slate-700 p-8 scroll-mt-10">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-cyan-400" />
              Authentication
            </h2>
            <p className="text-slate-300 mb-6 leading-relaxed">
              All API requests must include your unique API Key in the <code className="text-cyan-400 bg-slate-900 px-2 py-0.5 rounded">x-api-key</code> HTTP header. 
            </p>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <pre className="text-slate-400 font-mono text-sm">
                x-api-key: apex_live_s0m3R4nd0mK3y...
              </pre>
            </div>
          </section>

          {/* Verification Endpoint */}
          <section id="endpoint" className="bg-slate-800/50 rounded-3xl border border-slate-700 p-8 scroll-mt-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Verify Badge</h2>
                <p className="text-slate-400">Fetch athlete details from a scanned QR code.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-3 py-1 bg-cyan-500 text-black font-black text-xs rounded uppercase">POST</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">application/json</span>
              </div>
            </div>
            
            <div className="mb-10">
              <code className="text-lg text-cyan-300 font-mono bg-slate-950 p-4 rounded-2xl border border-slate-800 block break-all">
                {baseUrl}/api/v1/verify
              </code>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Request Body</h3>
                <table className="w-full text-sm">
                  <thead className="text-left border-b border-slate-700 text-slate-500">
                    <tr>
                      <th className="pb-2">Field</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Required</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr>
                      <td className="py-3 font-mono text-cyan-400">badgeId</td>
                      <td className="py-3">String</td>
                      <td className="py-3 text-emerald-500 font-bold">Yes</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-500 italic">Accepts system UUID, Badge Number (ATH-XXX), or internal ID.</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Response Fields</h3>
                <div className="space-y-3">
                  {[
                    { f: "success", t: "Boolean", d: "True if verification passed" },
                    { f: "partner", t: "String", d: "Your registered partner name" },
                    { f: "data", t: "Object", d: "Allocated athlete details" }
                  ].map((field, i) => (
                    <div key={i} className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="font-mono text-xs text-white">{field.f}</span>
                      <span className="text-[10px] text-slate-500">{field.d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          {/* Field Reference Section */}
          <section id="fields" className="scroll-mt-10">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Database className="w-6 h-6 text-cyan-400" />
              Field Reference
            </h2>
            <p className="text-slate-300 mb-6">
              The <code className="text-cyan-400">data</code> object in a successful response contains athlete details. 
              Availability depends on your API key permissions.
            </p>
            <div className="bg-slate-800/30 rounded-3xl border border-slate-700 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Field Name</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {[
                    { n: "firstName", d: "The athlete's first name", e: "Fatma" },
                    { n: "lastName", d: "The athlete's last name", e: "Abdullah" },
                    { n: "role", d: "Accreditation category (Athlete, Coach, etc.)", e: "Athlete" },
                    { n: "badgeNumber", d: "Public-facing unique ID", e: "ATH-155" },
                    { n: "club", d: "Registered sports organization", e: "Dubai Swimming Club" },
                    { n: "nationality", d: "Country of representation", e: "United Arab Emirates" },
                    { n: "photoUrl", d: "Secure URL to the profile photo", e: "/api/proxy/..." },
                    { n: "status", d: "Current accreditation state", e: "approved" }
                  ].map((field, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 font-mono text-cyan-400">{field.n}</td>
                      <td className="px-6 py-4">{field.d}</td>
                      <td className="px-6 py-4 text-slate-500">{field.e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Code Examples Tabs */}
            <div className="bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
              <div className="flex border-b border-slate-800 bg-slate-900/50">
                {["curl", "javascript", "python"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all ${
                      activeTab === tab ? "text-cyan-400 bg-slate-950 border-b-2 border-cyan-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab === "curl" ? "cURL" : tab === "javascript" ? "Node.js" : "Python"}
                  </button>
                ))}
              </div>
              <div className="relative p-6 group">
                <button 
                  onClick={() => copyToClipboard(codeExamples[activeTab])}
                  className="absolute top-4 right-4 p-2 bg-slate-800/50 text-slate-400 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <pre className="text-slate-300 font-mono text-sm leading-relaxed overflow-auto max-h-[400px]">
                  {codeExamples[activeTab]}
                </pre>
              </div>
            </div>
          </section>

          {/* Error Handling Section */}
          <section id="errors" className="scroll-mt-10">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              Error Handling
            </h2>
            <div className="bg-slate-800/30 rounded-3xl border border-slate-700 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Error Message</th>
                    <th className="px-6 py-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr>
                    <td className="px-6 py-4 font-bold text-red-400">400</td>
                    <td className="px-6 py-4">badgeId is required</td>
                    <td className="px-6 py-4">Missing payload in request body.</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-bold text-red-400">401</td>
                    <td className="px-6 py-4">API Key is required</td>
                    <td className="px-6 py-4">Missing x-api-key header.</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-bold text-red-400">403</td>
                    <td className="px-6 py-4">Invalid or revoked API Key</td>
                    <td className="px-6 py-4">The key exists but is no longer active.</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-bold text-red-400">404</td>
                    <td className="px-6 py-4">Badge/Athlete not found</td>
                    <td className="px-6 py-4">The ID does not match any record.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Data Allocation Section */}
          <section className="bg-emerald-500/5 rounded-3xl border border-emerald-500/20 p-8">
            <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-3">
              <Database className="w-6 h-6" />
              Data Allocation Policy
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              For security and GDPR compliance, the <strong>data</strong> object returned by the API is filtered dynamically. 
              Only the fields explicitly allocated by the Admin when generating your API key will be included in the response.
              Common fields include: <code className="text-emerald-400">firstName</code>, <code className="text-emerald-400">lastName</code>, <code className="text-emerald-400">role</code>, and <code className="text-emerald-400">photoUrl</code>.
            </p>
          </section>
        </div>
      </div>

      <footer className="mt-20 pt-10 border-t border-slate-800 text-center text-slate-500 text-xs">
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> System Stable</span>
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SSL Encryption Active</span>
        </div>
        &copy; 2026 Apex Sports Academy | API Support: technical@apexsports.com
      </footer>
    </div>
  );
}

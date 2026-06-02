import React, { useState } from "react";
import { Search, ChevronRight, User } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function StaffSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      // Basic mock search for demonstration
      const { data, error } = await supabase
        .from("accreditations")
        .select("id, name, role, badge_number, status")
        .or(`name.ilike.%${query}%,badge_number.ilike.%${query}%`)
        .limit(10);
        
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
          Directory
        </h2>
        <p className="text-slate-400 font-medium text-sm">
          Search attendees by name or badge number.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter name or badge..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
        <button type="submit" className="hidden">Search</button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-3 pb-8">
        {loading ? (
          <div className="text-center py-10 text-white/30 text-sm font-bold uppercase tracking-widest animate-pulse">
            Searching...
          </div>
        ) : results.length > 0 ? (
          results.map((person) => (
            <div key={person.id} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-4 active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{person.name}</h3>
                  <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider mt-1">
                    <span className="text-blue-400">{person.role}</span>
                    <span className="text-white/30">•</span>
                    <span className="text-white/50">#{person.badge_number}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/20" />
            </div>
          ))
        ) : query && !loading ? (
          <div className="text-center py-10 text-white/30 text-sm font-bold uppercase tracking-widest">
            No Results Found
          </div>
        ) : (
          <div className="text-center py-10 opacity-20">
            <Search className="w-12 h-12 mx-auto mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">Enter a query above</p>
          </div>
        )}
      </div>
    </div>
  );
}

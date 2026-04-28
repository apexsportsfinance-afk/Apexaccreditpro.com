import React, { useState, useMemo } from 'react';
import { DownloadCloud, Check, X, Search, FileText, FileImage, LayoutGrid, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

// Utility for file-format icons
const FormatIcon = ({ format, active }) => {
  const icons = {
    xlsx: <LayoutGrid className={`w-5 h-5 ${active ? 'text-emerald-500' : 'text-slate-500'}`} />,
    csv: <FileText className={`w-5 h-5 ${active ? 'text-blue-500' : 'text-slate-500'}`} />,
    pdf: <FileImage className={`w-5 h-5 ${active ? 'text-red-500' : 'text-slate-500'}`} />
  };
  return icons[format] || null;
};

export default function ExportModal({ open, onClose, clubs, initialSelectedClubs = [], onExport }) {
  const [format, setFormat] = useState('xlsx');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  React.useEffect(() => {
    if (open) {
      if (initialSelectedClubs.length > 0) {
        setSelectedClubs(initialSelectedClubs);
      } else if (clubs && clubs.length > 0) {
        // Fallback: If no rows were checked in the main table, pre-select all clubs
        // so the user can just click "Generate Export" instantly.
        setSelectedClubs(clubs.map(c => c.full));
      } else {
        setSelectedClubs([]);
      }
      setSearchTerm('');
    }
  }, [open, initialSelectedClubs, clubs]);

  const filteredClubs = useMemo(() => {
    if (!searchTerm) return clubs;
    const term = searchTerm.toLowerCase();
    return clubs.filter(c => 
      String(c.full).toLowerCase().includes(term) || 
      String(c.short).toLowerCase().includes(term)
    );
  }, [clubs, searchTerm]);

  const allSelected = clubs.length > 0 && selectedClubs.length === clubs.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedClubs([]);
    } else {
      setSelectedClubs(clubs.map(c => c.full));
    }
  };

  const toggleClub = (clubFull) => {
    if (selectedClubs.includes(clubFull)) {
      setSelectedClubs(selectedClubs.filter(c => c !== clubFull));
    } else {
      setSelectedClubs([...selectedClubs, clubFull]);
    }
  };

  const removeClub = (clubFull) => {
    setSelectedClubs(selectedClubs.filter(c => c !== clubFull));
  };

  const handleExport = async () => {
    if (selectedClubs.length === 0) return;
    setIsExporting(true);
    setProgressMsg("Preparing data...");
    
    try {
      // Find the actual club objects for the selected names to pass down
      const clubsToExport = clubs.filter(c => selectedClubs.includes(c.full));
      
      // onExport is a prop function injected by Events.jsx that handles the API fetching & JSZip
      await onExport(clubsToExport, format, setProgressMsg);
      
      // Close heavily requested success!
      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setProgressMsg("");
      }, 500);
      
    } catch (error) {
      console.error("Export Error:", error);
      setIsExporting(false);
      setProgressMsg("");
    }
  };

  return (
    <Modal isOpen={open} onClose={() => !isExporting && onClose()} title="Export Club Data">
      <div className="p-6 space-y-8">
        
        {/* Step 1: Format Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">1. Choose Format</label>
          <div className="grid grid-cols-3 gap-3">
            {['xlsx', 'csv', 'pdf'].map(fmt => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  format === fmt 
                    ? 'border-primary-500 bg-primary-500/10' 
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <FormatIcon format={fmt} active={format === fmt} />
                <span className={`mt-2 text-xs font-bold uppercase tracking-wider ${
                  format === fmt ? 'text-primary-400' : 'text-slate-400'
                }`}>
                  {fmt}
                </span>
                {format === fmt && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-primary-500" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Club Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">2. Select Clubs</label>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-64">
            
            {/* Search Top Bar */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <div className="relative flex-1 mr-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search clubs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <button 
                onClick={toggleAll}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-wider whitespace-nowrap"
              >
                {allSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>

            {/* Club List scroll container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredClubs.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-sm">No clubs found</div>
              ) : (
                filteredClubs.map(club => {
                  const isSelected = selectedClubs.includes(club.full);
                  return (
                    <div 
                      key={club.full}
                      onClick={() => toggleClub(club.full)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary-500/10 border border-primary-500/20' 
                          : 'hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${isSelected ? 'text-primary-300' : 'text-slate-300'}`}>
                          {club.full}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{club.short}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected 
                          ? 'bg-primary-500 border-primary-500 text-white' 
                          : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Selected Summary Tags */}
        {selectedClubs.length > 0 && (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
              {selectedClubs.length} Club{selectedClubs.length !== 1 ? 's' : ''} Selected
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
              {selectedClubs.map(clubFull => (
                <span 
                  key={clubFull} 
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:border-slate-600 transition-colors"
                >
                  {clubFull}
                  <button onClick={() => removeClub(clubFull)} className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer Action */}
        <div className="pt-4 border-t border-slate-800/50 flex flex-col items-center">
           {selectedClubs.length > 1 && (
             <div className="w-full mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
               <DownloadCloud className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
               <p className="text-xs text-indigo-300 leading-relaxed font-medium">
                 Since multiple clubs are selected, exporting will combine them into a single <strong className="text-white bg-indigo-500/20 px-1 py-0.5 rounded">.zip</strong> archive containing separate {format.toUpperCase()} files for each club.
               </p>
             </div>
           )}

          <Button 
            className="w-full text-lg py-6 shadow-xl shadow-primary-900/20" 
            onClick={handleExport}
            disabled={selectedClubs.length === 0 || isExporting}
            loading={isExporting}
            icon={DownloadCloud}
          >
            {isExporting ? (progressMsg || "Generating...") : "Generate Export"}
          </Button>
        </div>

      </div>
    </Modal>
  );
}

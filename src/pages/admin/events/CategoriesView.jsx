import React, { useState, useEffect } from "react";
import {
  Plus, Edit, Trash2, Check, AlertCircle,
  Shield, Activity, PlusCircle, Palette
} from "lucide-react";
import Card, { CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import MultiSearchableSelect from "../../../components/ui/MultiSearchableSelect";
import { useToast } from "../../../components/ui/Toast";
import { EventCategoriesAPI, CategoriesAPI } from "../../../lib/storage";
import { GlobalSettingsAPI } from "../../../lib/broadcastApi";

const COLOR_PRESETS = [
  "#0ea5e9", "#0284c7", "#0369a1", "#06b6d4", "#0891b2",
  "#0e7490", "#3b82f6", "#2563eb", "#1d4ed8", "#6366f1",
  "#4f46e5", "#3730a3", "#14b8a6", "#0d9488", "#0f766e"
];

function BadgeColorPicker({ defaultValue, name }) {
  const [color, setColor] = useState(defaultValue || COLOR_PRESETS[0]);
  
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">Badge Color</label>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap items-center gap-2.5 mb-2">
        {COLOR_PRESETS.map(c => (
          <button 
            type="button" 
            key={c} 
            onClick={() => setColor(c)} 
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 ${color === c ? 'border-white shadow-xl scale-110' : 'border-transparent'}`} 
            style={{ backgroundColor: c }} 
            title={c}
          />
        ))}
        <div className="w-px h-6 bg-slate-700/50 mx-1 flex-shrink-0" />
        <div className="flex items-center gap-2">
          <label 
            className={`relative w-8 h-8 rounded-full border-2 cursor-pointer transition-transform hover:scale-105 flex items-center justify-center overflow-hidden ${!COLOR_PRESETS.includes(color) ? 'border-white shadow-xl shadow-white/10' : 'border-slate-500 bg-slate-800'}`} 
            style={{ backgroundColor: !COLOR_PRESETS.includes(color) ? color : undefined }}
            title="Custom RGB/Hex Color"
          >
             <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="opacity-0 absolute w-full h-full cursor-pointer" />
             {COLOR_PRESETS.includes(color) && <Palette className="w-4 h-4 text-slate-400" />}
          </label>
          {!COLOR_PRESETS.includes(color) && (
            <span className="text-xs font-mono text-slate-200 font-bold px-2 py-1 bg-slate-800 rounded uppercase border border-slate-700">{color}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">Pick a preset or custom RGB/HEX color to print on physical badge ribbons.</p>
    </div>
  );
}

export default function CategoriesView({ event, availableCategories, onClose }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState([]);
  const toast = useToast();

  const [eventClubs, setEventClubs] = useState([]);
  const [eventSports, setEventSports] = useState([]);
  const [categoryAllowlists, setCategoryAllowlists] = useState({});
  const [categorySports, setCategorySports] = useState({});
  const [categoryDocuments, setCategoryDocuments] = useState({});
  const [categoryCustomFields, setCategoryCustomFields] = useState({});

  const [catModal, setCatModal] = useState({ open: false, mode: "add_main", data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, data: null });
  const [tempAllowlist, setTempAllowlist] = useState([]);
  const [tempSports, setTempSports] = useState([]);
  const [tempDocuments, setTempDocuments] = useState([]);
  const [tempCustomFields, setTempCustomFields] = useState([]);
  const [eventCustomFields, setEventCustomFields] = useState([]);

  useEffect(() => {
    loadData();
  }, [event.id]);

  useEffect(() => {
    setCats(availableCategories);
  }, [availableCategories]);

  const loadData = async () => {
    try {
      const [data, clubsList, allowlistRaw, sportsRaw, eventSportsRaw, docsRaw, customFieldsEventRaw, categoryCustomFieldsRaw] = await Promise.all([
        EventCategoriesAPI.getByEventId(event.id),
        GlobalSettingsAPI.getClubs(event.id),
        GlobalSettingsAPI.get(`event_${event.id}_category_allowlist`),
        GlobalSettingsAPI.get(`event_${event.id}_category_sports`),
        GlobalSettingsAPI.get(`event_${event.id}_sport`),
        GlobalSettingsAPI.get(`event_${event.id}_category_documents`),
        GlobalSettingsAPI.get(`event_${event.id}_custom_fields`),
        GlobalSettingsAPI.get(`event_${event.id}_category_custom_fields`)
      ]);
      setSelectedCategories(data.map(r => r.categoryId));
      
      const parsedClubs = clubsList.map(c => c.full || c.short || c).sort();
      setEventClubs(parsedClubs);

      if (eventSportsRaw) {
        try {
          const parsed = JSON.parse(eventSportsRaw);
          setEventSports(Array.isArray(parsed) ? parsed : [eventSportsRaw]);
        } catch(e) {
          setEventSports([eventSportsRaw]);
        }
      } else {
        setEventSports(event.sportList && event.sportList.length > 0 ? event.sportList : ["Swimming"]);
      }
      
      if (allowlistRaw) setCategoryAllowlists(typeof allowlistRaw === 'string' ? JSON.parse(allowlistRaw) : allowlistRaw);
      if (sportsRaw) setCategorySports(typeof sportsRaw === 'string' ? JSON.parse(sportsRaw) : sportsRaw);
      if (docsRaw) {
          const parsed = typeof docsRaw === 'string' ? JSON.parse(docsRaw) : docsRaw;
          const normalized = {};
          for (const [k, v] of Object.entries(parsed)) {
            normalized[k] = (v || []).map(x => typeof x === 'string' ? x.toLowerCase() : x);
          }
          setCategoryDocuments(normalized);
        }

      if (customFieldsEventRaw) {
        try {
          const parsed = typeof customFieldsEventRaw === 'string' ? JSON.parse(customFieldsEventRaw) : customFieldsEventRaw;
          setEventCustomFields(Array.isArray(parsed) ? parsed : []);
        } catch { setEventCustomFields([]); }
      }

      if (categoryCustomFieldsRaw) {
        try {
          const parsed = typeof categoryCustomFieldsRaw === 'string' ? JSON.parse(categoryCustomFieldsRaw) : categoryCustomFieldsRaw;
          setCategoryCustomFields(parsed || {});
        } catch { setCategoryCustomFields({}); }
      }
    } catch (err) {
      console.error("Failed to load category data", err);
    }
  };

  const toggleCategory = (id) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await EventCategoriesAPI.setForEvent(event.id, selectedCategories);
      await GlobalSettingsAPI.set(`event_${event.id}_category_allowlist`, JSON.stringify(categoryAllowlists));
      await GlobalSettingsAPI.set(`event_${event.id}_category_sports`, JSON.stringify(categorySports));
      await GlobalSettingsAPI.set(`event_${event.id}_category_documents`, JSON.stringify(categoryDocuments));
      await GlobalSettingsAPI.set(`event_${event.id}_category_custom_fields`, JSON.stringify(categoryCustomFields));
      toast.success("Categories and rules updated successfully");
      onClose();
    } catch (err) {
      console.error("Save config error:", err);
      toast.error("Failed to save changes: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const openCatModal = (mode, data = null) => {
    const categoryId = data?.id;
    if (mode === "edit" && categoryId) {
      setTempAllowlist(categoryAllowlists[categoryId] || []);
      setTempSports(categorySports[categoryId] || []);
      setTempDocuments(categoryDocuments[categoryId] || []);
      setTempCustomFields(categoryCustomFields[categoryId] || []);
    } else {
      setTempAllowlist([]);
      setTempSports([]);
      setTempDocuments([]);
      setTempCustomFields([]);
    }
    setCatModal({ open: true, mode, data });
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawName = formData.get("name");
    const payload = {
      name: rawName,
      slug: rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substr(2, 4),
      badgeColor: formData.get("badgeColor") || "#0ea5e9",
      textColor: formData.get("textColor") || "#ffffff",
      fontSize: formData.get("fontSize") || "14px",
      fontWeight: formData.get("fontWeight") || "bold",
      description: formData.get("description") || "",
      parentId: catModal.mode === "add_sub" ? catModal.data.parentId : (catModal.data?.parentId || null),
      status: "active"
    };

    try {
      let savedCat;
      if (catModal.mode.startsWith("add")) {
        savedCat = await CategoriesAPI.create(payload);
        setCats(prev => [...prev, savedCat].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Category created");
      } else {
        savedCat = await CategoriesAPI.update(catModal.data.id, payload);
        setCats(prev => prev.map(c => c.id === savedCat.id ? savedCat : c));
        toast.success("Category updated");
      }

      const finalId = savedCat.id;
      if (finalId) {
        setCategoryAllowlists(prev => ({ ...prev, [finalId]: tempAllowlist }));
        setCategorySports(prev => ({ ...prev, [finalId]: tempSports }));
        setCategoryDocuments(prev => ({ ...prev, [finalId]: tempDocuments }));
        setCategoryCustomFields(prev => ({ ...prev, [finalId]: tempCustomFields }));
      }

      setCatModal({ open: false, mode: "add_main", data: null });
    } catch (err) {
      toast.error("Failed to save category");
    }
  };

  const handleDeleteCat = async () => {
    if (!deleteModal.data) return;
    try {
      const inUse = await CategoriesAPI.isInUse(deleteModal.data.id);
      if (inUse) {
        toast.error("Cannot delete category currently assigned to attendees");
        return;
      }
      await CategoriesAPI.delete(deleteModal.data.id);
      setCats(prev => prev.filter(c => c.id !== deleteModal.data.id && c.parentId !== deleteModal.data.id));
      toast.success("Category deleted");
      setDeleteModal({ open: false, data: null });
    } catch (err) {
      toast.error("Failed to delete category");
    }
  };

  const mainCategories = cats.filter(c => !c.parentId);
  const subCategories = cats.filter(c => !!c.parentId);
  const groupedCategories = mainCategories.map(parent => ({
    ...parent,
    children: subCategories.filter(child => child.parentId === parent.id).sort((a,b) => a.name.localeCompare(b.name))
  })).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-3xl font-black text-main mb-2 tracking-tighter uppercase italic">Categories Management</h3>
              <p className="text-slate-400 font-light text-lg">Define roles, edit names, and set exclusive club dropdown limits for registration.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" icon={Plus} onClick={() => openCatModal('add_main')}>
                Add Main Group
              </Button>
              <Button onClick={save} loading={saving}>Save Config</Button>
            </div>
          </div>

          <div className="space-y-8">
            {groupedCategories.map(parent => (
              <div key={parent.id} className="bg-base-alt/50 rounded-3xl border border-border overflow-hidden shadow-xl group/parent">
                <div className="flex items-center justify-between p-6 bg-base-alt border-b border-border transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-primary-500 rounded-full" />
                    <h4 className="text-2xl font-black text-main tracking-widest uppercase">{parent.name}</h4>
                    <span className="px-3 py-1 bg-base border border-border rounded-lg text-xs font-bold text-muted">{parent.children.length} roles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openCatModal('add_sub', { parentId: parent.id })} className="text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 mr-2">
                       Add Sub-Role
                    </Button>
                    <button onClick={() => openCatModal('edit', parent)} className="p-2 bg-base hover:bg-border border border-border rounded-lg text-muted hover:text-main transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteModal({ open: true, data: parent })} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {parent.children.map(cat => (
                    <div
                      key={cat.id}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-300 flex flex-col group ${
                        selectedCategories.includes(cat.id)
                          ? "border-primary-500 bg-primary-500/10 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.3)]"
                          : "border-border bg-base/50 hover:border-primary-500/30 hover:bg-base-alt"
                      }`}
                    >
                      <div 
                        className="flex items-start justify-between cursor-pointer mb-4"
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 mt-0.5 transition-colors ${
                            selectedCategories.includes(cat.id) ? "bg-primary-500 border-primary-500 text-white" : "border-border text-transparent"
                          }`}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h5 className={`text-base font-bold uppercase tracking-wide leading-none mb-1.5 ${selectedCategories.includes(cat.id) ? "text-primary-600 dark:text-white" : "text-main group-hover:text-primary-600 dark:group-hover:text-primary-400"}`}>
                              {cat.name}
                            </h5>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-3 h-3 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: cat.badgeColor }} />
                              {cat.description && (
                                <p className="text-xs font-medium text-muted line-clamp-1">{cat.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <div className="flex flex-col gap-1.5 flex-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} 
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                                categoryAllowlists[cat.id]?.length > 0 
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20" 
                                : "bg-base text-muted border border-border"
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            {categoryAllowlists[cat.id]?.length > 0 ? `${categoryAllowlists[cat.id].length} Clubs` : "Clubs: All"}
                          </button>

                          <button 
                            onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} 
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                              categorySports[cat.id]?.length > 0 
                                ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20" 
                                : "bg-base text-muted border border-border"
                            }`}
                          >
                            <Activity className="w-3.5 h-3.5" />
                            {categorySports[cat.id]?.length > 0 ? `${categorySports[cat.id].length} Sports` : "Sports: All"}
                          </button>

                          <button 
                            onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} 
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                              categoryCustomFields[cat.id]?.length > 0 
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            {categoryCustomFields[cat.id]?.length > 0 ? `${categoryCustomFields[cat.id].length} Custom Fields` : "Fields: None"}
                          </button>
                        </div>

                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat) }} className="p-1.5 text-slate-500 hover:text-white bg-transparent hover:bg-slate-800 rounded transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, data: cat }) }} className="p-1.5 text-slate-500 hover:text-red-400 bg-transparent hover:bg-red-500/10 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {parent.children.length === 0 && (
                    <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                      <p className="text-slate-500 font-light text-lg">No sub-roles defined for this group.</p>
                      <Button variant="ghost" className="mt-2 text-primary-400" onClick={() => openCatModal('add_sub', { parentId: parent.id })}>Add Sub-Role</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={catModal.open} onClose={() => setCatModal({ open: false, mode: 'add_main', data: null })} title={catModal.mode === 'edit' ? "Edit Category" : catModal.mode === "add_sub" ? "Add Sub-Role" : "Add Parent Group"}>
        <form onSubmit={handleSaveCat} className="p-6 space-y-5">
          <Input label="Category Name" name="name" defaultValue={catModal.data?.name || ""} placeholder="e.g. VIP, Media, Athlete" required />
          <Input label="Description (Optional)" name="description" defaultValue={catModal.data?.description || ""} placeholder="Brief description of this role" />
          <div className="grid grid-cols-2 gap-4">
            <BadgeColorPicker defaultValue={catModal.data?.badgeColor} name="badgeColor" />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Text Color</label>
              <input type="color" name="textColor" defaultValue={catModal.data?.textColor || "#ffffff"} className="w-full h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Font Size</label>
              <select name="fontSize" defaultValue={catModal.data?.fontSize || "14px"} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white">
                <option value="10px">10px</option>
                <option value="12px">12px</option>
                <option value="14px">14px</option>
                <option value="16px">16px</option>
                <option value="18px">18px</option>
                <option value="20px">20px</option>
                <option value="24px">24px</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Font Weight</label>
              <select name="fontWeight" defaultValue={catModal.data?.fontWeight || "bold"} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white">
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="bold">Bold</option>
                <option value="900">Black / Extra Bold</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Allowed Sports</label>
              <MultiSearchableSelect 
                options={(eventSports || ["Swimming"]).map(s => ({ value: s.value || s, label: s.label || s }))}
                value={tempSports}
                onChange={setTempSports}
                placeholder="Select sports for this category..."
              />
              <p className="text-[10px] text-slate-500 mt-1">If empty, all event sports will be available to this role.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Exclusive Clubs</label>
              <MultiSearchableSelect 
                options={eventClubs.map(c => ({ value: c, label: c }))}
                value={tempAllowlist}
                onChange={setTempAllowlist}
                placeholder="Search and select clubs..."
                creatable={true}
                creatableText="Add club/organization:"
              />
              <p className="text-[10px] text-slate-500 mt-1">If empty, all clubs will be available to this role.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Required Documents</label>
              <MultiSearchableSelect 
                options={(event.requiredDocuments || []).map(d => ({ value: d.id || d, label: d.label || d }))}
                value={tempDocuments}
                onChange={setTempDocuments}
                placeholder="Select required documents..."
              />
              <p className="text-[10px] text-slate-500 mt-1">If empty, the event's default required documents will be used.</p>
            </div>
            {eventCustomFields.length > 0 && (
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Additional Information Fields</label>
                <MultiSearchableSelect
                  options={eventCustomFields.map(field => ({
                    value: field.id,
                    label: field.label_en || field.label_ar || field.label || field.id
                  }))}
                  value={tempCustomFields}
                  onChange={setTempCustomFields}
                  placeholder="Select fields to show for this role..."
                />
                <p className="text-[10px] text-slate-500 mt-1">Select specific fields or sub-options to show for this role. If nothing is selected, no additional fields will be displayed.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setCatModal({ open: false, mode: 'add_main', data: null })} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">{catModal.mode === 'edit' ? "Save Changes" : "Create Category"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, data: null })} title="Confirm Delete">
        <div className="p-6 space-y-6">
           <div className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
             <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
             <div>
               <h4 className="text-lg font-bold text-red-400">Permanently Delete?</h4>
               <p className="text-slate-300 mt-1 leading-relaxed">You are about to delete <span className="font-bold text-white">{deleteModal.data?.name}</span>. This action cannot be undone.</p>
             </div>
           </div>
           <div className="flex gap-3">
             <Button variant="secondary" onClick={() => setDeleteModal({ open: false, data: null })} className="flex-1">Cancel</Button>
             <Button variant="danger" onClick={handleDeleteCat} className="flex-1">Yes, Delete</Button>
           </div>
        </div>
      </Modal>
    </div>
  );
}


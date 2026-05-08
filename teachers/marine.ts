import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Settings, 
  Moon, 
  Sun,
  ClipboardCopy,
  Clock,
  Zap,
  Download,
  X,
  Users,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  AlertCircle,
  FileSpreadsheet,
  ShieldAlert,
  TriangleAlert
} from 'lucide-react';

/**
 * MICRO-OBSERVATION TRACKER (RAPID-FIRE ED)
 * Vertical Category List Layout
 * Features: Class Management, Quick-Text Prompts, CSV Export, and Student Editing/Deletion
 * Safety: Multi-stage class deletion with CSV export option.
 */

const DEFAULT_CATEGORIES = [
  { id: 'prep', label: 'Prep', icon: '📚' },
  { id: 'part', label: 'Part', icon: '🤝' },
  { id: 'task', label: 'Task', icon: '✅' },
  { id: 'lead', label: 'Lead', icon: '⭐' },
  { id: 'supp', label: 'Supp', icon: '🆘' },
  { id: 'focus', label: 'Focus', icon: '🎯' },
  { id: 'collab', label: 'Collab', icon: '👥' },
];

const DEFAULT_PROMPTS = [
  { id: 'p1', text: "On task" },
  { id: 'p2', text: "Distracted" },
  { id: 'p3', text: "Late" },
  { id: 'p4', text: "Peer support" },
  { id: 'p5', text: "Great insight" },
  { id: 'p6', text: "Need check-in" }
];

const App = () => {
  // --- State ---
  const [classes, setClasses] = useState([
    { id: 'c1', name: 'Period 1', students: ['Alice Smith', 'Bob Jones', 'Charlie Brown'] },
  ]);
  const [activeClassId, setActiveClassId] = useState('c1');
  const [observations, setObservations] = useState({});
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('prompts'); 
  const [editingStudent, setEditingStudent] = useState(null); 
  
  // Reset Confirmation State
  const [resettingStudent, setResettingStudent] = useState(null);

  // Class Deletion Protection (3 stages: 1, 2, 3)
  const [deletingClassStage, setDeletingClassStage] = useState(0); 
  const [classToDelete, setClassToDelete] = useState(null);

  // New Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassStudents, setNewClassStudents] = useState('');

  const activeClass = useMemo(() => 
    classes.find(c => c.id === activeClassId) || classes[0], 
    [classes, activeClassId]
  );

  // --- Logic ---
  const addClass = () => {
    if (!newClassName.trim()) return;
    const studentList = newClassStudents
      .split('\n')
      .map(s => s.trim())
      .filter(s => s !== '');
    
    const newId = `c${Date.now()}`;
    const newClassObj = {
      id: newId,
      name: newClassName,
      students: studentList.length > 0 ? studentList : ['New Student']
    };

    setClasses([...classes, newClassObj]);
    setActiveClassId(newId);
    setNewClassName('');
    setNewClassStudents('');
    setShowAddClassModal(false);
  };

  const finalizeClassDelete = (shouldExport) => {
    if (!classToDelete) return;
    
    if (shouldExport) {
      exportToCSV(null, classToDelete.id);
    }

    const newClasses = classes.filter(c => c.id !== classToDelete.id);
    setClasses(newClasses);
    
    // Clean up all observations for this class
    setObservations(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.endsWith(`_${classToDelete.id}`)) {
          delete next[key];
        }
      });
      return next;
    });

    if (activeClassId === classToDelete.id) {
      setActiveClassId(newClasses[0]?.id || '');
    }

    setDeletingClassStage(0);
    setClassToDelete(null);
  };

  const deleteStudent = (studentName) => {
    setClasses(prev => prev.map(c => {
      if (c.id === activeClassId) {
        return { ...c, students: c.students.filter(s => s !== studentName) };
      }
      return c;
    }));
    const key = `${studentName}_${activeClassId}`;
    setObservations(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const renameStudent = () => {
    if (!editingStudent || !editingStudent.newName.trim()) {
      setEditingStudent(null);
      return;
    }
    const { oldName, newName } = editingStudent;
    setClasses(prev => prev.map(c => {
      if (c.id === activeClassId) {
        return { ...c, students: c.students.map(s => s === oldName ? newName : s) };
      }
      return c;
    }));
    setObservations(prev => {
      const oldKey = `${oldName}_${activeClassId}`;
      const newKey = `${newName}_${activeClassId}`;
      if (prev[oldKey]) {
        const next = { ...prev };
        next[newKey] = prev[oldKey];
        delete next[oldKey];
        return next;
      }
      return prev;
    });
    setEditingStudent(null);
  };

  const addPrompt = (text) => {
    setPrompts([...prompts, { id: `p_${Date.now()}`, text }]);
  };
  
  const removePrompt = (id) => {
    setPrompts(prompts.filter(p => p.id !== id));
  };
  
  const updatePromptText = (id, newText) => {
    setPrompts(prompts.map(p => p.id === id ? { ...p, text: newText } : p));
  };

  const addCategory = () => {
    setCategories([...categories, { id: `cat_${Date.now()}`, label: 'NEW', icon: '📌' }]);
  };
  
  const removeCategory = (id) => {
    setCategories(categories.filter(c => c.id !== id));
  };
  
  const updateCategoryLabel = (id, newLabel) => {
    setCategories(categories.map(c => c.id === id ? { ...c, label: newLabel } : c));
  };

  const updateCategoryIcon = (id, newIcon) => {
    setCategories(categories.map(c => c.id === id ? { ...c, icon: newIcon } : c));
  };

  const exportToCSV = (specificStudentName = null, targetClassId = activeClassId) => {
    const targetClass = classes.find(c => c.id === targetClassId);
    if (!targetClass) return;
    
    const studentToExport = specificStudentName ? [specificStudentName] : targetClass.students;
    const headers = ['Student', ...categories.map(c => c.label), 'Notes'];
    
    const rows = studentToExport.map(student => {
      const data = observations[`${student}_${targetClassId}`] || {};
      const studentScores = categories.map(c => data[c.id] || '');
      const note = (data.comment || '').replace(/"/g, '""');
      return [student, ...studentScores, `"${note}"`].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = specificStudentName 
      ? `Obs_${specificStudentName}_${new Date().toLocaleDateString()}.csv`
      : `Obs_${targetClass.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString()}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const finalizeReset = (shouldExport) => {
    if (shouldExport) {
      exportToCSV(resettingStudent);
    }
    const key = `${resettingStudent}_${activeClassId}`;
    setObservations(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setResettingStudent(null);
  };

  const updateObservation = (studentName, categoryId, value) => {
    const key = `${studentName}_${activeClassId}`;
    setObservations(prev => {
      const currentVal = prev[key]?.[categoryId];
      const newObs = { ...prev[key] };
      if (currentVal === value) {
        delete newObs[categoryId];
      } else {
        newObs[categoryId] = value;
      }
      return { ...prev, [key]: newObs };
    });
  };

  const updateComment = (studentName, text) => {
    const key = `${studentName}_${activeClassId}`;
    setObservations(prev => ({
      ...prev,
      [key]: { ...prev[key], comment: text }
    }));
  };

  const appendPrompt = (studentName, prompt) => {
    const key = `${studentName}_${activeClassId}`;
    const currentComment = observations[key]?.comment || "";
    const newComment = currentComment ? `${currentComment}, ${prompt}` : prompt;
    updateComment(studentName, newComment);
  };

  const generateProse = (studentName) => {
    const data = observations[`${studentName}_${activeClassId}`];
    if (!data) return "No data recorded.";
    const scores = categories.map(cat => ({ label: cat.label, val: data[cat.id] || 0 }));
    const high = scores.filter(s => s.val === 3).map(s => s.label.toLowerCase());
    const low = scores.filter(s => s.val === 1).map(s => s.label.toLowerCase());
    let prose = `${studentName}: `;
    if (high.length) prose += `Strong in ${high.join(', ')}. `;
    if (low.length) prose += `Needs support in ${low.join(', ')}. `;
    if (data.comment) prose += data.comment;
    return prose;
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.style.opacity = '1';
      setTimeout(() => toast.style.opacity = '0', 2000);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col ${isDarkMode ? 'bg-black text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-20 border-b p-4 ${isDarkMode ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-slate-200'} backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
              <Clock className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase italic leading-none">MicroTracker</h1>
              <p className="text-[10px] opacity-60 font-mono uppercase tracking-widest mt-1">Class Management</p>
            </div>
          </div>

          {/* CLASS SELECTOR BAR */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-xl no-scrollbar flex-1 lg:justify-center px-4">
            {classes.map(c => (
              <div key={c.id} className="relative group">
                <button
                  onClick={() => setActiveClassId(c.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border pr-10 ${
                    activeClassId === c.id 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' 
                    : isDarkMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {c.name}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setClassToDelete(c);
                    setDeletingClassStage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-red-500/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button 
              onClick={() => setShowAddClassModal(true)}
              className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-indigo-400 hover:bg-zinc-700' : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'}`}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => exportToCSV()}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                isDarkMode 
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <Download size={16} />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-yellow-400' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className={`p-2 rounded-xl border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'}`}
            >
                <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {activeClass?.students.map((student) => {
            const obs = observations[`${student}_${activeClassId}`] || {};
            const isEditing = editingStudent?.oldName === student;
            
            return (
              <div 
                key={student} 
                className={`rounded-[2.5rem] border p-6 flex flex-col transition-all relative group ${
                  isDarkMode 
                  ? 'bg-zinc-900 border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]' 
                  : 'bg-white border-slate-200 shadow-xl'
                }`}
              >
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6 gap-2">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input 
                          autoFocus
                          className={`w-full text-xl font-black uppercase tracking-tighter bg-black/20 border-b-2 border-indigo-500 outline-none px-1 rounded-sm ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                          value={editingStudent.newName}
                          onChange={(e) => setEditingStudent({ ...editingStudent, newName: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && renameStudent()}
                        />
                        <button onClick={renameStudent} className="p-1 text-emerald-500"><Check size={20} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group-hover:pr-20 transition-all">
                        <h3 className="text-xl font-black uppercase tracking-tighter text-indigo-400 truncate">
                          {student}
                        </h3>
                        <button 
                          onClick={() => setEditingStudent({ oldName: student, newName: student })}
                          className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity p-1"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={() => setResettingStudent(student)}
                      title="Reset observations"
                      className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-amber-500' : 'bg-slate-100 hover:bg-slate-200 text-slate-400'}`}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button 
                      onClick={() => deleteStudent(student)}
                      title="Delete student"
                      className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-zinc-800 hover:bg-red-900/40 text-zinc-500 hover:text-red-500' : 'bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generateProse(student))}
                      title="Copy prose"
                      className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-400'}`}
                    >
                      <ClipboardCopy size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-sm">{cat.icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${
                            isDarkMode ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                            {cat.label}
                        </span>
                      </div>
                      <div className={`flex rounded-2xl p-1 gap-1 border ${isDarkMode ? 'bg-black/40 border-zinc-800' : 'bg-slate-100 border-slate-200'}`}>
                        {[1, 2, 3].map((val) => (
                          <button
                            key={val}
                            onClick={() => updateObservation(student, cat.id, val)}
                            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${
                              obs[cat.id] === val
                                ? val === 1 ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-[1.02]' :
                                  val === 2 ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-[1.02]' :
                                  'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-[1.02]'
                                : isDarkMode ? 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30' : 'text-slate-400 hover:bg-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-2 px-1 opacity-60">
                    <Zap size={10} className="text-indigo-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Quick Prompts</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {prompts.map(prompt => (
                      <button
                        key={prompt.id}
                        onClick={() => appendPrompt(student, prompt.text)}
                        className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                          isDarkMode 
                          ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {prompt.text}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  placeholder="Additional notes..."
                  value={obs.comment || ''}
                  onChange={(e) => updateComment(student, e.target.value)}
                  className={`w-full text-[11px] font-medium p-4 rounded-3xl border outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-24 resize-none ${
                    isDarkMode 
                    ? 'bg-black border-zinc-800 text-zinc-300 placeholder-zinc-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                />
              </div>
            );
          })}
          
          <button 
            onClick={() => {
              const name = prompt("Enter student name:");
              if (name) {
                setClasses(prev => prev.map(c => 
                  c.id === activeClassId ? { ...c, students: [...c.students, name] } : c
                ));
              }
            }}
            className={`rounded-[2.5rem] border-2 border-dashed p-6 flex flex-col items-center justify-center min-h-[300px] transition-all group ${
              isDarkMode 
              ? 'border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-zinc-600' 
              : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400'
            }`}
          >
            <div className="p-4 rounded-full border-2 border-dashed border-inherit group-hover:scale-110 transition-transform">
              <Plus size={32} />
            </div>
            <span className="mt-4 font-black uppercase tracking-[0.2em] text-[10px]">Add Student</span>
          </button>
        </div>
      </main>

      {/* CLASS DELETION MODAL (3 STAGES) */}
      {deletingClassStage > 0 && classToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`w-full max-w-sm rounded-[3rem] border p-10 shadow-2xl text-center ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
            
            {/* STAGE 1: Initial Ask */}
            {deletingClassStage === 1 && (
              <>
                <div className="bg-red-500/10 text-red-500 p-5 rounded-full w-fit mx-auto mb-6">
                  <Trash2 size={40} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-4">Delete {classToDelete.name}?</h2>
                <p className="text-xs opacity-60 uppercase tracking-widest font-bold mb-8 leading-relaxed">This will remove the entire period and all student names from this list.</p>
                <div className="space-y-3">
                    <button onClick={() => setDeletingClassStage(2)} className="w-full py-5 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500 transition-all">Yes, Continue</button>
                    <button onClick={() => setDeletingClassStage(0)} className={`w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100`}>Cancel</button>
                </div>
              </>
            )}

            {/* STAGE 2: Confirmation */}
            {deletingClassStage === 2 && (
              <>
                <div className="bg-amber-500/10 text-amber-500 p-5 rounded-full w-fit mx-auto mb-6 animate-pulse">
                  <TriangleAlert size={40} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-4 text-amber-500 underline decoration-4">Wait! Are you sure?</h2>
                <p className="text-xs opacity-60 uppercase tracking-widest font-bold mb-8 leading-relaxed">All observation data currently in memory for this class will be lost forever.</p>
                <div className="space-y-3">
                    <button onClick={() => setDeletingClassStage(3)} className="w-full py-5 bg-amber-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-amber-500 transition-all">I am sure, continue</button>
                    <button onClick={() => setDeletingClassStage(0)} className={`w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100`}>Actually, Stop</button>
                </div>
              </>
            )}

            {/* STAGE 3: Final Safety & Export */}
            {deletingClassStage === 3 && (
              <>
                <div className="bg-red-600 text-white p-5 rounded-full w-fit mx-auto mb-6 shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                  <ShieldAlert size={40} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-4 text-red-500">Final Confirmation</h2>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-8 opacity-80">Do you want to export a CSV of current observations for <span className="text-indigo-400">"{classToDelete.name}"</span> before deleting everything?</p>
                <div className="space-y-3">
                    <button 
                      onClick={() => finalizeClassDelete(true)} 
                      className="w-full py-5 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all"
                    >
                        <FileSpreadsheet size={18} />
                        Export & Delete
                    </button>
                    <button 
                      onClick={() => finalizeClassDelete(false)} 
                      className="w-full py-4 bg-red-600/20 border-2 border-red-600/50 text-red-500 font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-600 hover:text-white transition-all"
                    >
                        Just Delete All
                    </button>
                    <button onClick={() => setDeletingClassStage(0)} className={`w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100`}>Keep the class</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* RESET STUDENT CONFIRMATION MODAL */}
      {resettingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-[2.5rem] border p-8 shadow-2xl text-center ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
            <div className="bg-amber-500/10 text-amber-500 p-4 rounded-full w-fit mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter italic mb-2">Reset {resettingStudent}?</h2>
            <p className="text-xs opacity-60 uppercase tracking-widest font-bold mb-8">Would you like to export these observations to CSV before clearing them?</p>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => finalizeReset(true)}
                className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <FileSpreadsheet size={18} />
                Export & Clear
              </button>
              <button 
                onClick={() => finalizeReset(false)}
                className={`py-4 font-black uppercase tracking-[0.2em] rounded-2xl transition-all border ${isDarkMode ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'}`}
              >
                Clear Only
              </button>
              <button 
                onClick={() => setResettingStudent(null)}
                className="py-3 text-[10px] font-black uppercase tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CLASS MODAL */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">Create Class</h2>
              <button onClick={() => setShowAddClassModal(false)} className="p-2 opacity-50 hover:opacity-100 transition-opacity">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-2 px-1">Class Name</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Period 2 Chemistry"
                  className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-black border-zinc-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-2 px-1">Students (one per line)</label>
                <textarea 
                  value={newClassStudents}
                  onChange={(e) => setNewClassStudents(e.target.value)}
                  placeholder="John Doe&#10;Jane Smith&#10;..."
                  className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500 h-48 resize-none ${isDarkMode ? 'bg-black border-zinc-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <button 
                onClick={addClass}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-3xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3"
              >
                <Users size={18} />
                Create Period
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl flex flex-col max-h-[85vh] ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 opacity-50 hover:opacity-100 transition-opacity">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex gap-2 mb-4 shrink-0 p-1 rounded-2xl bg-black/10 dark:bg-black/40">
              <button 
                onClick={() => setSettingsTab('prompts')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${settingsTab === 'prompts' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Prompts
              </button>
              <button 
                onClick={() => setSettingsTab('metrics')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${settingsTab === 'metrics' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Metrics
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-4 p-1">
              {settingsTab === 'prompts' && prompts.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={p.text}
                    onChange={(e) => updatePromptText(p.id, e.target.value)}
                    className={`flex-1 px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold ${isDarkMode ? 'bg-black/50 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                  <button onClick={() => removePrompt(p.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              
              {settingsTab === 'metrics' && categories.map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={c.icon}
                    onChange={(e) => updateCategoryIcon(c.id, e.target.value)}
                    className={`w-12 text-center px-0 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold ${isDarkMode ? 'bg-black/50 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                  <input 
                    type="text" 
                    value={c.label}
                    onChange={(e) => updateCategoryLabel(c.id, e.target.value)}
                    className={`flex-1 px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'bg-black/50 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                  <button onClick={() => removeCategory(c.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {settingsTab === 'prompts' && (
              <button 
                onClick={() => addPrompt('New Prompt')}
                className="w-full py-4 bg-indigo-600/20 text-indigo-500 hover:bg-indigo-600 hover:text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 shrink-0 border-2 border-indigo-600/50"
              >
                <Plus size={18} />
                Add Prompt
              </button>
            )}
            
            {settingsTab === 'metrics' && (
              <button 
                onClick={addCategory}
                className="w-full py-4 bg-indigo-600/20 text-indigo-500 hover:bg-indigo-600 hover:text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 shrink-0 border-2 border-indigo-600/50"
              >
                <Plus size={18} />
                Add Metric
              </button>
            )}
          </div>
        </div>
      )}

      <div id="toast" className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-2xl opacity-0 transition-opacity pointer-events-none z-50">
        Copied to clipboard
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

    </div>
  );
};

export default App;
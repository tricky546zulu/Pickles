import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'; // Make sure this path is correct

// --- Helper Components ---

// Icon for medication administration
const PillIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path>
    <path d="m8.5 8.5 7 7"></path>
  </svg>
);

// Icon for a general note
const NoteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);


// --- Main Component ---

export default function MedicationLogger({ medications = [] }) {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const notesEndRef = useRef(null);

    // Get current user session
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
        };
        fetchUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Fetch initial notes
    useEffect(() => {
        if (!user) return;

        const fetchNotes = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching notes:', error);
                setError(error.message);
            } else {
                setNotes(data);
            }
            setLoading(false);
        };

        fetchNotes();
    }, [user]);

    // Scroll to bottom of notes list when new notes are added
    useEffect(() => {
        notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [notes]);

    // Set up real-time subscription
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('public:notes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    setNotes((prevNotes) => [...prevNotes, payload.new]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Handle form submission for new notes
    const handleAddNote = async (e) => {
        e.preventDefault();
        if (newNote.trim() === '' || !user) return;

        const { error } = await supabase
            .from('notes')
            .insert({
                content: newNote,
                user_id: user.id,
                is_administration: false,
            });

        if (error) {
            console.error('Error adding note:', error);
            setError(error.message);
        } else {
            setNewNote('');
        }
    };

    // Handle clicking a medication to log its administration
    const handleAdministerMedication = async (medicationName) => {
        if (!user) return;

        const { error } = await supabase
            .from('notes')
            .insert({
                content: `Administered ${medicationName}.`,
                medication_name: medicationName,
                user_id: user.id,
                is_administration: true,
            });

        if (error) {
            console.error('Error logging medication:', error);
            setError(error.message);
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <p className="text-gray-600">Please sign in to view and add notes.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg max-w-2xl mx-auto font-sans">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Medication & Note Log</h2>

            {/* Medication Buttons */}
            {medications && medications.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase">Log Administration:</h3>
                    <div className="flex flex-wrap gap-2">
                        {medications.map((med) => (
                            <button
                                key={med.id}
                                onClick={() => handleAdministerMedication(med.name)}
                                className="px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-full hover:bg-indigo-200 transition-colors duration-200 text-sm flex items-center gap-2"
                            >
                                <PillIcon /> {med.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Notes Display */}
            <div className="h-96 bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4 border border-gray-200">
                {loading && <p className="text-center text-gray-500">Loading notes...</p>}
                {error && <p className="text-center text-red-500">Error: {error}</p>}
                {!loading && notes.length === 0 && (
                    <p className="text-center text-gray-500 h-full flex items-center justify-center">No notes yet. Add one below!</p>
                )}
                <ul className="space-y-4">
                    {notes.map((note) => (
                        <li key={note.id} className="flex items-start gap-3">
                           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mt-1">
                                {note.is_administration ? <PillIcon /> : <NoteIcon />}
                            </div>
                            <div className="flex-1">
                                <p className={`text-gray-800 ${note.is_administration ? 'font-semibold' : ''}`}>{note.content}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {new Date(note.created_at).toLocaleString()}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
                <div ref={notesEndRef} />
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="flex gap-3">
                <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a custom note..."
                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                />
                <button
                    type="submit"
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:bg-indigo-300"
                    disabled={newNote.trim() === ''}
                >
                    Add Note
                </button>
            </form>
        </div>
    );
}

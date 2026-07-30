"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface NotesState {
  // Scratchpad quick note
  scratchpad: string;
  setScratchpad: (content: string) => void;

  // Notes list
  notes: NoteItem[];
  addNote: (title: string, content?: string) => NoteItem;
  updateNote: (id: string, updates: Partial<Pick<NoteItem, "title" | "content" | "pinned">>) => void;
  deleteNote: (id: string) => void;

  // Checklist
  todos: TodoItem[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  clearCompletedTodos: () => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      scratchpad: "",

      setScratchpad: (content) => set({ scratchpad: content }),

      notes: [],

      addNote: (title, content = "") => {
        const newNote: NoteItem = {
          id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: title || "New Note",
          content,
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        return newNote;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
          ),
        }));
      },

      deleteNote: (id) => {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      },

      todos: [],

      addTodo: (text) => {
        if (!text.trim()) return;
        const newTodo: TodoItem = {
          id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: text.trim(),
          completed: false,
          createdAt: Date.now(),
        };
        set((state) => ({ todos: [newTodo, ...state.todos] }));
      },

      toggleTodo: (id) => {
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
        }));
      },

      deleteTodo: (id) => {
        set((state) => ({ todos: state.todos.filter((t) => t.id !== id) }));
      },

      clearCompletedTodos: () => {
        set((state) => ({ todos: state.todos.filter((t) => !t.completed) }));
      },
    }),
    {
      name: "cubeforge_notes_storage",
    }
  )
);

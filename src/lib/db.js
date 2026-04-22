// src/lib/db.js
import { IS_DEMO, db } from './firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore'
import * as demo from './demoData'

// ── PORTFOLIOS ───────────────────────────────────────────────────────────────

export function subscribePortfolios(userId, callback) {
  if (IS_DEMO) return demo.subscribePortfolios(userId, callback)
  const q = query(collection(db, 'portfolios'), where('userId', '==', userId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export async function createPortfolio(userId, data) {
  if (IS_DEMO) return demo.createPortfolio(userId, data)
  return addDoc(collection(db, 'portfolios'), { ...data, userId, cash: 0, createdAt: serverTimestamp() })
}

export async function updatePortfolio(id, data) {
  if (IS_DEMO) return demo.updatePortfolio(id, data)
  return updateDoc(doc(db, 'portfolios', id), data)
}

export async function deletePortfolio(id) {
  if (IS_DEMO) return demo.deletePortfolio(id)
  const posSnap = await getDocs(query(collection(db, 'positions'), where('portfolioId', '==', id)))
  await Promise.all(posSnap.docs.map(d => deleteDoc(d.ref)))
  return deleteDoc(doc(db, 'portfolios', id))
}

export async function updatePortfolioCash(portfolioId, cash) {
  if (IS_DEMO) return demo.updatePortfolioCash(portfolioId, cash)
  return updateDoc(doc(db, 'portfolios', portfolioId), { cash: parseFloat(cash) || 0 })
}

// ── POSITIONS ────────────────────────────────────────────────────────────────

export function subscribePositions(portfolioId, callback) {
  if (IS_DEMO) return demo.subscribePositions(portfolioId, callback)
  const q = query(collection(db, 'positions'), where('portfolioId', '==', portfolioId))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export async function addPosition(portfolioId, userId, data) {
  if (IS_DEMO) return demo.addPosition(portfolioId, userId, data)
  return addDoc(collection(db, 'positions'), {
    ...data, portfolioId, userId,
    shares:  parseFloat(data.shares),
    avgCost: parseFloat(data.avgCost),
    sector:  data.sector  || null,
    beta:    data.beta    ? parseFloat(data.beta)    : null,
    low52w:  data.low52w  ? parseFloat(data.low52w)  : null,
    high52w: data.high52w ? parseFloat(data.high52w) : null,
    addedAt: serverTimestamp()
  })
}

export async function updatePosition(id, data) {
  if (IS_DEMO) return demo.updatePosition(id, data)
  return updateDoc(doc(db, 'positions', id), {
    ...data,
    shares:  parseFloat(data.shares),
    avgCost: parseFloat(data.avgCost),
    sector:  data.sector  || null,
    beta:    data.beta    ? parseFloat(data.beta)    : null,
    low52w:  data.low52w  ? parseFloat(data.low52w)  : null,
    high52w: data.high52w ? parseFloat(data.high52w) : null,
  })
}

export async function deletePosition(id) {
  if (IS_DEMO) return demo.deletePosition(id)
  return deleteDoc(doc(db, 'positions', id))
}

// ── JOURNAL ──────────────────────────────────────────────────────────────────

export function subscribeJournal(userId, callback) {
  if (IS_DEMO) return demo.subscribeJournal(userId, callback)
  const q = query(collection(db, 'journal'), where('userId', '==', userId), orderBy('date', 'desc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export async function addJournalEntry(userId, data) {
  if (IS_DEMO) return demo.addJournalEntry(userId, data)
  return addDoc(collection(db, 'journal'), { ...data, userId, createdAt: serverTimestamp() })
}

export async function updateJournalEntry(id, data) {
  if (IS_DEMO) return demo.updateJournalEntry(id, data)
  return updateDoc(doc(db, 'journal', id), data)
}

export async function deleteJournalEntry(id) {
  if (IS_DEMO) return demo.deleteJournalEntry(id)
  return deleteDoc(doc(db, 'journal', id))
}

// ── SNAPSHOTS ─────────────────────────────────────────────────────────────────

export async function saveSnapshot(portfolioId, userId, totalValue) {
  if (IS_DEMO) return demo.saveSnapshot(portfolioId, userId, totalValue)
  const today = new Date().toISOString().split('T')[0]
  return addDoc(collection(db, 'snapshots'), { portfolioId, userId, totalValue, date: today, savedAt: serverTimestamp() })
}

export async function getSnapshots(portfolioId) {
  if (IS_DEMO) return demo.getSnapshots(portfolioId)
  const q = query(collection(db, 'snapshots'), where('portfolioId', '==', portfolioId), orderBy('savedAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── TRADE HISTORY ─────────────────────────────────────────────────────────────

export async function addTradeHistory(userId, data) {
  if (IS_DEMO) return demo.addTradeHistory(userId, data)
  return addDoc(collection(db, 'tradeHistory'), { ...data, userId, closedAt: serverTimestamp() })
}

export function subscribeTradeHistory(userId, callback) {
  if (IS_DEMO) return demo.subscribeTradeHistory(userId, callback)
  const q = query(collection(db, 'tradeHistory'), where('userId', '==', userId), orderBy('closedAt', 'desc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
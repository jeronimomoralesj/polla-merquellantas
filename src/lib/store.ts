import "server-only";
import {
  matchesCollection,
  predictionsCollection,
  usersCollection,
} from "./mongodb";
import { fetchLatestFromConfiguredProvider } from "./providers";
import { buildMatchSeed, buildUserSeed } from "./seed-data";
import type { MatchDoc, PredictionDoc, UserDoc } from "./types";

async function ensureMatchesSeeded(): Promise<void> {
  const col = await matchesCollection();
  const count = await col.estimatedDocumentCount();
  if (count > 0) return;
  let docs: MatchDoc[] = [];
  try {
    const result = await fetchLatestFromConfiguredProvider();
    docs = result.docs;
  } catch (err) {
    console.warn("Failed to fetch from provider, using static seed:", err);
  }
  if (docs.length === 0) docs = buildMatchSeed();
  if (docs.length === 0) return;
  await col.insertMany(docs);
  await col.createIndex({ utcDate: 1 });
  await col.createIndex({ stage: 1, group: 1, matchday: 1 });
}

async function ensureUsersSeeded(): Promise<void> {
  const col = await usersCollection();
  const count = await col.estimatedDocumentCount();
  if (count > 0) return;
  const docs = buildUserSeed();
  if (docs.length === 0) return;
  await col.insertMany(docs);
  await col.createIndex({ email: 1 }, { unique: true });
}

export async function getAllMatches(): Promise<MatchDoc[]> {
  await ensureMatchesSeeded();
  const col = await matchesCollection();
  return col.find({}).sort({ utcDate: 1 }).toArray();
}

export async function findUserByCredentials(
  email: string,
  nit: string,
): Promise<UserDoc | null> {
  await ensureUsersSeeded();
  const col = await usersCollection();
  const cleanEmail = email.trim().toLowerCase();
  const cleanNit = nit.replace(/\D/g, "");
  return col.findOne({ email: cleanEmail, nit: cleanNit });
}

export async function getUserByEmail(email: string): Promise<UserDoc | null> {
  const col = await usersCollection();
  return col.findOne({ email: email.trim().toLowerCase() });
}

export async function listPredictionsForUser(
  email: string,
): Promise<PredictionDoc[]> {
  const col = await predictionsCollection();
  return col
    .find({ userEmail: email.trim().toLowerCase() })
    .sort({ attempt: 1 })
    .toArray();
}

export async function getPrediction(
  email: string,
  attempt: number,
): Promise<PredictionDoc | null> {
  const col = await predictionsCollection();
  return col.findOne({
    userEmail: email.trim().toLowerCase(),
    attempt,
  });
}

export async function upsertPrediction(doc: PredictionDoc): Promise<void> {
  const col = await predictionsCollection();
  await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
}

export async function isTournamentLocked(): Promise<boolean> {
  const col = await matchesCollection();
  const first = await col
    .find({ stage: "GROUP_STAGE" })
    .sort({ utcDate: 1 })
    .limit(1)
    .toArray();
  if (!first.length) return false;
  return new Date(first[0].utcDate).getTime() <= Date.now();
}

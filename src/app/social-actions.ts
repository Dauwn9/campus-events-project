"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from "@/lib/services/social";
import { markNotificationRead } from "@/lib/services/notifications";
import { ServiceError } from "@/lib/services/errors";

function readId(formData: FormData, key: string) {
  return z.string().min(1).max(128).parse(formData.get(key));
}

function redirectOnServiceError(error: unknown, path: string): never {
  if (error instanceof ServiceError) {
    redirect(`${path}?error=${encodeURIComponent(error.code)}`);
  }
  throw error;
}

export async function sendFriendRequestAction(formData: FormData) {
  const student = await requireRole("STUDENT");
  try {
    sendFriendRequest(student, readId(formData, "studentId"));
  } catch (error) {
    redirectOnServiceError(error, "/friends");
  }
  revalidatePath("/friends");
  redirect("/friends?success=request-sent");
}

export async function respondToFriendRequestAction(formData: FormData) {
  const student = await requireRole("STUDENT");
  const friendshipId = readId(formData, "friendshipId");
  const decision = z.enum(["accept", "decline"]).parse(formData.get("decision"));
  const accept = decision === "accept";
  try {
    respondToFriendRequest(student, friendshipId, accept);
  } catch (error) {
    redirectOnServiceError(error, "/friends");
  }
  revalidatePath("/friends");
  redirect(accept ? "/friends?success=accepted" : "/friends?success=declined");
}

export async function removeFriendAction(formData: FormData) {
  const student = await requireRole("STUDENT");
  try {
    removeFriend(student, readId(formData, "studentId"));
  } catch (error) {
    redirectOnServiceError(error, "/friends");
  }
  revalidatePath("/friends");
  redirect("/friends?success=removed");
}

export async function markNotificationReadAction(formData: FormData) {
  const student = await requireRole("STUDENT");
  try {
    markNotificationRead(student, readId(formData, "notificationId"));
  } catch (error) {
    redirectOnServiceError(error, "/notifications");
  }
  revalidatePath("/notifications");
  redirect("/notifications?success=read");
}

import { z } from "zod";

export const studentGroupSchema = z
  .string()
  .trim()
  .max(40, "Учебная группа должна содержать не более 40 символов.");

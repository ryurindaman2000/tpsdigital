import { NextResponse } from 'next/server';
import { seedAdminToFirestore } from '@/lib/seed-firestore';

export async function GET() {
  const result = await seedAdminToFirestore();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await seedAdminToFirestore();
  return NextResponse.json(result);
}

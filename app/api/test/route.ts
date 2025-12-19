import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Try to query the database
        const productCount = await prisma.product.count()

        return NextResponse.json({
            success: true,
            message: 'Database connected!',
            productCount,
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 })
    }
}
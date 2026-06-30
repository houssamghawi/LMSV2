import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getCourseDetails } from "@/queries/courses";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { formatMyDate } from "@/lib/date";
import { verifyCertificateAccess } from "@/lib/certificate-helpers";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import mongoose from "mongoose";

/**
 * Load fonts dynamically (not at top level)
 */
async function loadFonts() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    try {
        const [kalamFontBytes, montserratItalicFontBytes, montserratFontBytes] = await Promise.all([
            fetch(`${baseUrl}/fonts/kalam/Kalam-Regular.ttf`).then(res => res.arrayBuffer()),
            fetch(`${baseUrl}/fonts/montserrat/Montserrat-Italic.ttf`).then(res => res.arrayBuffer()),
            fetch(`${baseUrl}/fonts/montserrat/Montserrat-Medium.ttf`).then(res => res.arrayBuffer())
        ]);
        
        return {
            kalamFontBytes,
            montserratItalicFontBytes,
            montserratFontBytes
        };
    } catch (error) {
        console.error('[CERTIFICATE] Error loading fonts:', error);
        // Fallback to standard fonts if custom fonts fail
        return {
            kalamFontBytes: null,
            montserratItalicFontBytes: null,
            montserratFontBytes: null
        };
    }
}

/**
 * Load images dynamically
 */
async function loadImages() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    try {
        const [logoBytes, signBytes, patternBytes] = await Promise.all([
            fetch(`${baseUrl}/logo.png`).then(res => res.arrayBuffer()),
            fetch(`${baseUrl}/sign.png`).then(res => res.arrayBuffer()),
            fetch(`${baseUrl}/pattern.jpg`).then(res => res.arrayBuffer())
        ]);
        
        return { logoBytes, signBytes, patternBytes };
    } catch (error) {
        console.error('[CERTIFICATE] Error loading images:', error);
        throw new Error('Failed to load certificate images');
    }
}

/**
 * Generate certificate PDF
 */
async function generateCertificate(completionInfo, fonts, images) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    const page = pdfDoc.addPage([841.89, 595.28]); // A4 landscape
    const { width, height } = page.getSize();
    
    // Embed fonts
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const kalamFont = fonts.kalamFontBytes 
        ? await pdfDoc.embedFont(fonts.kalamFontBytes)
        : timesRomanFont;
    const montserratItalic = fonts.montserratItalicFontBytes
        ? await pdfDoc.embedFont(fonts.montserratItalicFontBytes)
        : timesRomanFont;
    const montserrat = fonts.montserratFontBytes
        ? await pdfDoc.embedFont(fonts.montserratFontBytes)
        : timesRomanFont;
    
    // Embed images
    const logo = await pdfDoc.embedPng(images.logoBytes);
    const logoDims = logo.scale(0.5);
    const sign = await pdfDoc.embedPng(images.signBytes);
    const pattern = await pdfDoc.embedJpg(images.patternBytes);
    
    // Draw pattern background
    page.drawImage(pattern, {
        x: 0,
        y: 0,
        width: width,
        height: height,
        opacity: 0.2,
    });
    
    // Draw logo
    page.drawImage(logo, {
        x: width / 2 - logoDims.width / 2,
        y: height - 120,
        width: logoDims.width,
        height: logoDims.height,
    });
    
    // Title
    const titleFontSize = 30;
    const titleText = "Certificate Of Completion";
    const titleTextWidth = montserrat.widthOfTextAtSize(titleText, titleFontSize);
    
    page.drawText(titleText, {
        x: width / 2 - titleTextWidth / 2,
        y: height - (logoDims.height + 125),
        size: titleFontSize,
        font: montserrat,
        color: rgb(0, 0.53, 0.71),
    });
    
    // Name label
    const nameLabelText = "This certificate is hereby bestowed upon";
    const nameLabelFontSize = 20;
    const nameLabelTextWidth = montserratItalic.widthOfTextAtSize(nameLabelText, nameLabelFontSize);
    
    page.drawText(nameLabelText, {
        x: width / 2 - nameLabelTextWidth / 2,
        y: height - (logoDims.height + 170),
        size: nameLabelFontSize,
        font: montserratItalic,
        color: rgb(0, 0, 0),
    });
    
    // Student name
    const nameText = completionInfo.name;
    const nameFontSize = 40;
    const nameTextWidth = timesRomanFont.widthOfTextAtSize(nameText, nameFontSize);
    
    page.drawText(nameText, {
        x: width / 2 - nameTextWidth / 2,
        y: height - (logoDims.height + 220),
        size: nameFontSize,
        font: kalamFont,
        color: rgb(0, 0, 0),
    });
    
    // Details
    const detailsText = `This is to certify that ${completionInfo.name} successfully completed the ${completionInfo.courseName} course on ${completionInfo.completionDate} by ${completionInfo.instructor}`;
    const detailsFontSize = 16;
    
    page.drawText(detailsText, {
        x: width / 2 - 700 / 2,
        y: height - 330,
        size: detailsFontSize,
        font: montserrat,
        color: rgb(0, 0, 0),
        maxWidth: 700,
        wordBreaks: [" "],
    });
    
    // Signature
    const signatureBoxWidth = 300;
    page.drawText(completionInfo.instructor, {
        x: width - signatureBoxWidth,
        y: 90,
        size: detailsFontSize,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
    });
    
    if (completionInfo.instructorDesignation) {
        page.drawText(completionInfo.instructorDesignation, {
            x: width - signatureBoxWidth,
            y: 72,
            size: 10,
            font: timesRomanFont,
            color: rgb(0, 0, 0),
            maxWidth: 250
        });
    }
    
    page.drawLine({
        start: { x: width - signatureBoxWidth, y: 110 },
        end: { x: width - 60, y: 110 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    
    page.drawImage(sign, {
        x: width - signatureBoxWidth,
        y: 120,
        width: 180,
        height: 54,
    });
    
    return pdfDoc;
}

/**
 * GET /api/certificates/[courseId]
 * Generate and download certificate PDF
 */
export async function GET(request, { params }) {
    const logger = logRoute('/api/certificates/[courseId]', 'GET');
    logger.start();
    
    try {
        // 1. Authentication check
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error('Unauthorized'));
            return NextResponse.json(
                createErrorResponse('You must be logged in to download certificates.', ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }
        
        const userId = session.user.id;
        
        // 2. Rate limiting
        const ip = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        const rateLimitResult = rateLimit(`certificate:${userId}:${ip}`, 5, 60000); // 5 per minute
        
        if (!rateLimitResult.success) {
            logger.failure(new Error('Rate limited'));
            return NextResponse.json(
                createErrorResponse('Too many certificate requests. Please try again later.', ERROR_CODES.RATE_LIMITED),
                { status: 429 }
            );
        }
        
        // 3. Get courseId from params
        const { courseId } = await params;
        
        if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
            logger.failure(new Error('Invalid courseId'));
            return NextResponse.json(
                createErrorResponse('Invalid course ID.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 4. Verify access and completion (CRITICAL - server-side validation)
        const accessCheck = await verifyCertificateAccess(courseId, userId);
        
        if (!accessCheck.allowed) {
            logger.failure(new Error(accessCheck.error || 'Access denied'));
            return NextResponse.json(
                createErrorResponse(
                    accessCheck.error || 'You cannot download this certificate. Course must be 100% complete.',
                    ERROR_CODES.FORBIDDEN
                ),
                { status: 403 }
            );
        }
        
        // 5. Get course and user details
        const course = await getCourseDetails(courseId);
        const loggedInUser = await getLoggedInUser();
        
        if (!course || !loggedInUser) {
            logger.failure(new Error('Course or user not found'));
            return NextResponse.json(
                createErrorResponse('Course or user not found.', ERROR_CODES.NOT_FOUND),
                { status: 404 }
            );
        }
        
        // 6. Prepare completion info
        const completionDate = accessCheck.completionDate 
            ? formatMyDate(accessCheck.completionDate)
            : formatMyDate(new Date());
        
        const completionInfo = {
            name: `${loggedInUser.firstName} ${loggedInUser.lastName}`,
            completionDate: completionDate,
            courseName: course.title,
            instructor: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
            instructorDesignation: course.instructor?.designation || '',
        };
        
        // 7. Load fonts and images
        const fonts = await loadFonts();
        const images = await loadImages();
        
        // 8. Generate PDF
        const pdfDoc = await generateCertificate(completionInfo, fonts, images);
        const pdfBytes = await pdfDoc.save();
        
        // 9. Return PDF with proper headers
        const filename = `certificate-${course.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
        
        logger.success();
        return new NextResponse(pdfBytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBytes.length.toString(),
            },
        });
        
    } catch (error) {
        console.error('[CERTIFICATE] Error:', error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse(
                'Failed to generate certificate. Please try again.',
                ERROR_CODES.INTERNAL_ERROR
            ),
            { status: 500 }
        );
    }
}


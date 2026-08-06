'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
    useEffect(() => {
        // هذا السطر سيطبع الخطأ الحقيقي في الكونسول
        console.error("🚨 الخطأ الحقيقي هو:", error);
    }, [error]);

    return (
        <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: 'red' }}>حدث خطأ ما!</h2>
            <p>يرجى فتح الـ <b>Console</b> (F12) في المتصفح والبحث عن عبارة "الخطأ الحقيقي هو" لمعرفة السبب.</p>
            <button 
                onClick={() => reset()} 
                style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}
            >
                إعادة المحاولة
            </button>
        </div>
    );
}
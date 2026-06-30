import Image from 'next/image';
import React from 'react';
 
const MoneyBack = () => {
    return (
<div className='bg-blue-50 text-black px-4 py-4 md:px-16'>
     

    <div className='w-full bg-blue-50 p-6 flex flex-col md:flex-row items-center pt-5 pb-10 pl-10'>
    <div className='md:w-1/2 flex justify-center mb-6 md:mb-0'>
    <Image
            src="/assets/images/money.png"
            alt='Put Your Learning'
            width={500}
            height={400}
            className='rounded-lg' 
        />  
    </div>

    <div className='md:w-1/2 text-center md:text-left'>
        <h3 className='text-green-600 font-semibold text-lg mb-2'>TRY IT FOR RISK FREE</h3>
        <h2 className='text-gray-800 font-bold text-5xl mb-4'>30-Day Money-Back Guarantee</h2>
        <p className='text-gray-600'>You can ask for a refund any time during the first 30 days if you decide the course isn’t for you.</p>
        </div>  
    </div> 
    
</div>
    );
};

export default MoneyBack;
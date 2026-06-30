import React from 'react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
import { Radio } from "lucide-react";
import { Video } from "lucide-react";
import { NotepadText } from "lucide-react"; 
import CourseLessonList from './CourseLessonList';
import { getTranslations } from "next-intl/server";

const CourseModuleList = async ({ module }) => {
    const t = await getTranslations("Courses");
    const totalDuration = module?.lessonIds.reduce(function(acc, obj){
        return acc + obj.duration;
    },0)
   // console.log(module);

    return (
        <div>
    <AccordionItem className="border-none" value="item-1">
    <AccordionTrigger>{module?.title}</AccordionTrigger>
    <AccordionContent>
        {/* header */}
        <div className="flex gap-x-5 items-center flex-wrap mt-4 mb-6 text-gray-600 text-sm">
        <span className="flex items-center gap-1.5">
            <Video className="w-4 h-4" />
            {(totalDuration/3660).toPrecision(2)} {t("hours")}
        </span> 
        <span className="flex items-center gap-1.5">
            <Radio className="w-4 h-4" />1 {t("liveClass")}
        </span>
        </div>
        {/* header ends */}

        <div className="space-y-3">
            {
                module.lessonIds && module?.lessonIds.map(lesson => (
         <CourseLessonList key={lesson?.id ?? lesson?._id} lesson={lesson} />
                ))
            } 
    
        </div>
    </AccordionContent>
    </AccordionItem>        
        </div>
    );
};

export default CourseModuleList;
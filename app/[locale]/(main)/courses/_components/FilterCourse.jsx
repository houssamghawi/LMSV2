'use client'
import React, { useState } from 'react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from 'next-intl';

const PRICE_OPTIONS = [
    { labelKey: "free", value: "free" },
    { labelKey: "paid", value: "paid" },
  ];
  
   
  const CATEGORY_OPTIONS = [
    { id: 1, labelKey: "categoryDesign", value: "design" },
    { id: 3, labelKey: "categoryDevelopment", value: "development" },
    { id: 4, labelKey: "categoryMarketing", value: "marketing" },
    { id: 5, labelKey: "categoryItSoftware", value: "it-software" },
    { id: 6, labelKey: "categoryPersonalDevelopment", value: "personal-development" },
    { id: 7, labelKey: "categoryBusiness", value: "business" },
    { id: 8, labelKey: "categoryPhotography", value: "photography" },
    { id: 9, labelKey: "categoryMusic", value: "music" },
  ];
const FilterCourse = () => {
    const t = useTranslations('Courses');
    const [filter, setFilter] = useState({
        categories: ["development"],
        price: ["free"],
        sort: "",
      });
    
      //   apply checkbox filter
      const applyArrayFilter = ({ type, value }) => {
        const isFilterApplied = filter[type].includes(value);
    
        if (isFilterApplied) {
          setFilter((prev) => ({
            ...prev,
            [type]: prev[type].filter((v) => v !== value),
          }));
        } else {
          setFilter((prev) => ({
            ...prev,
            [type]: [...prev[type], value],
          }));
        }
      };


    return (
        <div className="hidden lg:block">
            <Accordion defaultValue={["categories"]} type="multiple">
              {/* Categories filter */}
              <AccordionItem value="categories">
                <AccordionTrigger className="py-3 text-sm text-gray-400 hover:text-gray-500">
                  <span className="font-medium text-gray-900">{t('categories')}</span>
                </AccordionTrigger>

                <AccordionContent className="pt-6 animate-none">
                  <ul className="space-y-4">
                    {CATEGORY_OPTIONS.map((option, optionIdx) => (
                      <li key={option.value} className="flex items-center">
                        <Checkbox
                          type="checkbox"
                          id={`category-${optionIdx}`}
                          onCheckedChange={() => {
                            applyArrayFilter({
                              type: "categories",
                              value: option.value,
                            });
                          }}
                          checked={filter.categories.includes(option.value)}
                        />
                        <label
                          htmlFor={`category-${optionIdx}`}
                          className="ms-3 text-sm text-gray-600 cursor-pointer"
                        >
                          {t(option.labelKey)}
                        </label>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              {/* Price filter */}
              <AccordionItem value="price">
                <AccordionTrigger className="py-3 text-sm text-gray-400 hover:text-gray-500">
                  <span className="font-medium text-gray-900">{t('price')}</span>
                </AccordionTrigger>

                <AccordionContent className="pt-6 animate-none">
                  <ul className="space-y-4">
                    {PRICE_OPTIONS.map((option, optionIdx) => (
                      <li key={option.value} className="flex items-center">
                        <Checkbox
                          type="checkbox"
                          id={`price-${optionIdx}`}
                          onCheckedChange={() => {
                            applyArrayFilter({
                              type: "price",
                              value: option.value,
                            });
                          }}
                          checked={filter.price.includes(option.value)}
                        />
                        <label
                          htmlFor={`price-${optionIdx}`}
                          className="ms-3 text-sm text-gray-600 cursor-pointer"
                        >
                          {t(option.labelKey)}
                        </label>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
    );
};

export default FilterCourse;
'use client'
import React from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { useTranslations } from 'next-intl';

  const SORT_OPTIONS = [
    { labelKey: "sortPriceLowToHigh", value: "price-asc" },
    { labelKey: "sortPriceHighToLow", value: "price-desc" },
  ];

const SortCourse = () => {
    const t = useTranslations('Courses');
    return (
        <Select>
            <SelectTrigger className="w-[180px] border-none !border-b focus:ring-0 focus:ring-offset-0  overflow-hidden">
              <SelectValue placeholder={t('sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t('sortBy')}</SelectLabel>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem
                    className="cursor-pointer"
                    key={option.value}
                    value={option.value}
                  >
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
    );
};

export default SortCourse;
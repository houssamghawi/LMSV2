'use client'
import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

const CATEGORY_VALUE_TO_KEY = {
  design: "categoryDesign",
  development: "categoryDevelopment",
  marketing: "categoryMarketing",
  "it-software": "categoryItSoftware",
  "personal-development": "categoryPersonalDevelopment",
  business: "categoryBusiness",
  photography: "categoryPhotography",
  music: "categoryMusic",
};

const ActiveFilters = ({ filter, applyArrayFilter }) => {
    const t = useTranslations('Courses');
    const getCategoryLabel = (value) => t(CATEGORY_VALUE_TO_KEY[value] ?? value);
    const getPriceLabel = (value) => t(value);
    return (
        <div className="flex items-center gap-2 flex-wrap">
        {/* active categories */}
        {filter?.categories?.length > 0 &&
          filter.categories.map((category) => (
            <Button
              key={category}
              variant="ghost"
              className="text-xs h-7 bg-muted rounded-full gap-1 text-sky-700"
              onClick={() =>
                applyArrayFilter?.({ type: "categories", value: category })
              }
            >
              {getCategoryLabel(category)}
              <X className="w-3" />
            </Button>
          ))}
        {/* active prices */}
        {filter?.price?.length > 0 &&
          filter.price.map((price) => (
            <Button
              key={price}
              variant="ghost"
              className="text-xs h-7 bg-muted rounded-full gap-1 text-sky-700"
              onClick={() => applyArrayFilter?.({ type: "price", value: price })}
            >
              {getPriceLabel(price)}
              <X className="w-3" />
            </Button>
          ))}
      </div>
    );
};

export default ActiveFilters;
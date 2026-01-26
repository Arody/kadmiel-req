
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export type ProductSubcategory = {
    id: string;
    name: string;
    category_id: string;
};

export type ProductCategory = {
    id: string;
    name: string;
    subcategories: ProductSubcategory[];
};

export function useProductCategories() {
    return useQuery({
        queryKey: ['productCategories'],
        queryFn: async () => {
            // Fetch categories
            const { data: categories, error: categoriesError } = await supabase
                .from('product_categories')
                .select('*')
                .order('name');

            if (categoriesError) throw categoriesError;

            // Fetch subcategories
            const { data: subcategories, error: subcategoriesError } = await supabase
                .from('product_subcategories')
                .select('*')
                .order('name');

            if (subcategoriesError) throw subcategoriesError;

            // Nest subcategories under categories
            const nestedCategories: ProductCategory[] = categories.map(cat => ({
                ...cat,
                subcategories: subcategories.filter(sub => sub.category_id === cat.id)
            }));

            return nestedCategories;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

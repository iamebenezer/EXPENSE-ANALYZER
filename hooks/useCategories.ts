import { useState, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Category } from '../models/types';
import { useAuth } from '../context/AuthContext';

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const categoriesCollectionRef = collection(db, 'categories');
      const q = query(
        categoriesCollectionRef,
        or(
          where('isDefault', '==', true),
          where('userId', '==', user.uid)
        ),
        orderBy('name', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const fetchedCategories: Category[] = [];
      querySnapshot.forEach((doc) => {
        fetchedCategories.push({ id: doc.id, ...doc.data() } as Category);
      });
      setCategories(fetchedCategories);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError('Failed to fetch categories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const retry = useCallback(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { 
    categories, 
    isLoading, 
    error, 
    fetchCategories, 
    refetch: fetchCategories,
    retry 
  };
};

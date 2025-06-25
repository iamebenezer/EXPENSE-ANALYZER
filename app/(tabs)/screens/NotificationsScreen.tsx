"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { Budget, Category } from '../../../models/types';
import * as Animatable from 'react-native-animatable';
import { getBudgetNotifications } from '../../../utils/notificationUtils';

// Notification type
interface Notification {
  id: string;
  categoryId: string;
  categoryName: string;
  status: 'normal' | 'warning' | 'high-warning' | 'danger' | 'exceeded';
  message: string;
  percentage: number;
  timestamp: Date;
}

const NotificationsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const fetchNotificationData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      setError(null);
      
      // Fetch Categories (including default categories)
      const categoriesQuery = query(
        collection(db, 'categories'),
        or(
          where('isDefault', '==', true),
          where('userId', '==', user.uid)
        ),
        orderBy('name', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const fetchedCategories: Category[] = [];
      categoriesSnapshot.forEach(doc => fetchedCategories.push({ id: doc.id, ...doc.data() } as Category));
      setCategories(fetchedCategories);
      
      // Fetch Budgets
      const budgetsQuery = query(
        collection(db, 'budgets'), 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const budgetsSnapshot = await getDocs(budgetsQuery);
      const fetchedBudgets: Budget[] = [];
      budgetsSnapshot.forEach(doc => fetchedBudgets.push({ id: doc.id, ...doc.data() } as Budget));
      setBudgets(fetchedBudgets);
      
      // Generate notifications from budgets
      const budgetNotifications = getBudgetNotifications(fetchedBudgets, fetchedCategories);
      setNotifications(budgetNotifications);
      
    } catch (err: any) {
      console.error("Error fetching notification data: ", err);
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);
  
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotificationData();
    }, [fetchNotificationData])
  );
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotificationData();
  }, [fetchNotificationData]);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'warning':
        return <Ionicons name="alert-circle" size={24} color="#FF9800" />;
      case 'high-warning':
        return <Ionicons name="warning-outline" size={24} color="#FF6F00" />;
      case 'danger':
        return <Ionicons name="warning" size={24} color="#FF5722" />;
      case 'exceeded':
        return <Ionicons name="alert" size={24} color="#F44336" />;
      default:
        return <Ionicons name="information-circle" size={24} color={theme.colors.primary} />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'warning':
        return '#FF9800';
      case 'high-warning':
        return '#FF6F00';
      case 'danger':
        return '#FF5722';
      case 'exceeded':
        return '#F44336';
      default:
        return theme.colors.primary;
    }
  };
  
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <Animatable.View 
      animation="fadeIn" 
      duration={500} 
      style={[
        styles.notificationItem,
        { 
          backgroundColor: theme.colors.card,
          borderLeftColor: getStatusColor(item.status),
        }
      ]}
    >
      <View style={styles.notificationIconContainer}>
        {getStatusIcon(item.status)}
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
          {item.categoryName} Budget
        </Text>
        <Text style={[styles.notificationMessage, { color: theme.colors.textLight }]}>
          {item.message}
        </Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(item.percentage, 100)}%`,
                  backgroundColor: getStatusColor(item.status) 
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textLight }]}>
            {item.percentage.toFixed(1)}%
          </Text>
        </View>
      </View>
    </Animatable.View>
  );
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.fontSizes.lg,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginLeft: theme.spacing.sm,
    },
    content: {
      flex: 1,
      padding: theme.spacing.sm,
    },
    notificationItem: {
      flexDirection: 'row',
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      borderLeftWidth: 4,
    },
    notificationIconContainer: {
      marginRight: theme.spacing.sm,
      justifyContent: 'center',
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
      marginBottom: 2,
    },
    notificationMessage: {
      fontSize: theme.fontSizes.sm,
      marginBottom: theme.spacing.xs,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    progressBar: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      marginRight: theme.spacing.xs,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressText: {
      fontSize: theme.fontSizes.xs,
      fontWeight: 'bold',
      width: 40,
      textAlign: 'right',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    emptyText: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textLight,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
    backButton: {
      padding: theme.spacing.xs,
    },
  });
  
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text, marginTop: theme.spacing.md }}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen 
        options={{
          title: 'Budget Notifications',
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
        }}
      />
      
      <View style={styles.content}>
        {notifications.length > 0 ? (
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[theme.colors.primary]} 
                tintColor={theme.colors.primary} 
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>
              No budget notifications at the moment. You're doing great with your budgets!
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default NotificationsScreen;

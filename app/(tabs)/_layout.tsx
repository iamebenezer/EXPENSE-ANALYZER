import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';

const TabLayoutInner = () => {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          display: 'none',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="screens/ExpensesScreen"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wallet.pass.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="screens/BudgetScreen"
        options={{
          title: 'Budgets',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.pie.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      {/* Add CategoriesScreen here, hidden from the tab bar */}
      <Tabs.Screen
        name="screens/CategoriesScreen"
        options={{
          title: 'Manage Categories',
          href: null,
          headerShown: true
        }}
      />
      {/* Add ExportReportsScreen here, hidden from the tab bar */}
      <Tabs.Screen
        name="screens/ExportReportsScreen"
        options={{
          title: 'Export Reports',
          href: null,
          headerShown: true
        }}
      />
      {/* ProfileScreen Tab - can be visible or hidden depending on preference */}
      <Tabs.Screen
        name="screens/ProfileScreen"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          // href: null, // Uncomment to hide from tab bar if it's accessed via a button elsewhere
        }}
      />
      {/* Add AddExpenseScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/AddExpenseScreen" 
        options={{
          title: 'Add Expense',
          href: null, 
          headerShown: true 
        }}
      />
       {/* Add AddCategoryScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/AddCategoryScreen" 
        options={{
          title: 'Add Category',
          href: null, 
          headerShown: true 
        }}
      />
      {/* Add EditExpenseScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/EditExpenseScreen" 
        options={{
          title: 'Edit Expense',
          href: null, 
          headerShown: true 
        }}
      />
      {/* Add EditProfileScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/EditProfileScreen" 
        options={{
          title: 'Edit Profile',
          href: null, 
          headerShown: true 
        }}
      />
       {/* Add AddBudgetScreen here, hidden from the tab bar */}
       <Tabs.Screen 
        name="screens/AddBudgetScreen" 
        options={{
          title: 'Add Budget',
          href: null, 
          headerShown: true 
        }}
      />
      {/* Add EditBudgetScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/EditBudgetScreen" 
        options={{
          title: 'Edit Budget',
          href: null, 
          headerShown: true 
        }}
      />
      {/* Add NotificationsScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/NotificationsScreen" 
        options={{
          title: 'Notifications',
          href: null, 
          headerShown: true 
        }}
      />
      {/* Add EditCategoryScreen here, hidden from the tab bar */}
      <Tabs.Screen 
        name="screens/EditCategoryScreen" 
        options={{
          title: 'Edit Category',
          href: null, 
          headerShown: true 
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <ThemeProvider>
      <TabLayoutInner />
    </ThemeProvider>
  );
}

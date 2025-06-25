"use client";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import DashboardScreen from "../app/(tabs)/screens/DashboardScreen";
import ExpensesScreen from "../app/(tabs)/screens/ExpensesScreen";
import BudgetScreen from "../app/(tabs)/screens/BudgetScreen";
import ProfileScreen from "../app/(tabs)/screens/ProfileScreen";
import AddExpenseScreen from "../app/(tabs)/screens/AddExpenseScreen";
import { useTheme } from "@/context/ThemeContext";

const Tab = createBottomTabNavigator();

const MainNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          paddingBottom: 8,
          height: 60,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Dashboard") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Expenses") {
            iconName = focused ? "wallet" : "wallet-outline";
          } else if (route.name === "Budgets") {
            iconName = focused ? "pie-chart" : "pie-chart-outline";
          } else if (route.name === "AddExpense") {
            iconName = focused ? "add-circle" : "add-circle-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Budgets" component={BudgetScreen} />
      <Tab.Screen 
        name="AddExpense" 
        component={AddExpenseScreen} 
        options={{
          title: "Add Expense",
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainNavigator;

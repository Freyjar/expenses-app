import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import AddExpenseScreen from "./src/screens/AddExpenseScreen";
import DebtsScreen from "./src/screens/DebtsScreen";
import CalculatorScreen from "./src/screens/CalculatorScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "#111", borderTopColor: "#222" },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#555",
        headerStyle: { backgroundColor: "#111" },
        headerTintColor: "#fff",
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: () => <Text>📊</Text> }}
      />
      <Tab.Screen
        name="Add"
        component={AddExpenseScreen}
        options={{ tabBarIcon: () => <Text>➕</Text>, title: "Add Expense" }}
      />
      <Tab.Screen
        name="Debts"
        component={DebtsScreen}
        options={{ tabBarIcon: () => <Text>💰</Text> }}
      />
      <Tab.Screen
        name="Calculator"
        component={CalculatorScreen}
        options={{ tabBarIcon: () => <Text>🧮</Text> }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

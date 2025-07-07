import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import FeedScreen from "../screens/FeedScreen";
import RecordScreen from "../screens/RecordScreen";
import HomeScreen from "../screens/HomeScreen";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  useEffect(() => {
    console.log("🎯 MainTabs component mounted");
    return () => {
      console.log("🎯 MainTabs component unmounted");
    };
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0.5,
          borderTopColor: "#E5E5EA",
          paddingBottom: 5,
          paddingTop: 5,
          height: 85,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Feed") {
            iconName = focused ? "list" : "list-outline";
          } else if (route.name === "Record") {
            iconName = focused ? "mic" : "mic-outline";
          } else if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else {
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        unmountOnBlur: false,
        lazy: false,
        detachInactiveScreens: false,
        freezeOnBlur: false,
        animationEnabled: false,
      })}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: "Whispers",
          tabBarLabel: "Whispers",
        }}
        listeners={{
          focus: () => {
            console.log("🎯 Feed tab focused");
          },
          blur: () => {
            console.log("🎯 Feed tab blurred");
          },
        }}
      />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          title: "Record",
          tabBarLabel: "Record",
        }}
        listeners={{
          focus: () => {
            console.log("🎯 Record tab focused");
          },
          blur: () => {
            console.log("🎯 Record tab blurred");
          },
        }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
        }}
        listeners={{
          focus: () => {
            console.log("🎯 Home tab focused");
          },
          blur: () => {
            console.log("🎯 Home tab blurred");
          },
        }}
      />
    </Tab.Navigator>
  );
}

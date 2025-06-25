"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../firebaseConfig"; 
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, 
  onAuthStateChanged,       
  signOut                   
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore"; 

interface User {
  uid: string; 
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUserProfile: (updatedData: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in using Firebase Auth State
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/firebase.User
        try {
          // Fetch user details from Firestore
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as Omit<User, 'uid'>; 
            const appUser: User = {
              uid: firebaseUser.uid,
              name: userData.name,
              email: userData.email,
            };
            await AsyncStorage.setItem("user", JSON.stringify(appUser));
            setUser(appUser);
          } else {
            // User exists in Auth but not in Firestore (edge case, could sign them out or create profile)
            console.warn("User exists in Auth but not in Firestore. Logging out.");
            await signOut(auth); 
            setUser(null);
            await AsyncStorage.removeItem("user");
          }
        } catch (error) {
          console.error("Failed to load user data from Firestore", error);
          setUser(null); 
          await AsyncStorage.removeItem("user");
        }
      } else {
        // User is signed out
        setUser(null);
        await AsyncStorage.removeItem("user");
      }
      setIsLoading(false);
    });

    return () => unsubscribe(); 
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // Fetch user details from Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as Omit<User, 'uid'>;
          const appUser: User = {
            uid: firebaseUser.uid,
            name: userData.name,
            email: userData.email,
          };
          await AsyncStorage.setItem("user", JSON.stringify(appUser));
          setUser(appUser);
          return true;
        } else {
          console.error("User authenticated but no profile found in Firestore.");
          return false;
        }
      }
      return false; 
    } catch (error: any) {
      console.error("Login error", error);
      return false;
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // Create user document in Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          name,
          email,
          createdAt: new Date(), 
        });

        const appUser: User = {
          uid: firebaseUser.uid,
          name,
          email,
        };

        await AsyncStorage.setItem("user", JSON.stringify(appUser));
        setUser(appUser);
        return true;
      }
      return false; 
    } catch (error: any) {
      console.error("Signup error", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth); 
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const updateUserProfile = async (updatedData: Partial<User>): Promise<boolean> => {
    if (!user) {
      console.error("No user to update");
      return false;
    }
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, updatedData); // Update Firestore

      // Update local state and AsyncStorage
      const newUser = { ...user, ...updatedData };
      setUser(newUser);
      await AsyncStorage.setItem("user", JSON.stringify(newUser));
      console.log("User profile updated successfully");
      return true;
    } catch (error) {
      console.error("Error updating user profile:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

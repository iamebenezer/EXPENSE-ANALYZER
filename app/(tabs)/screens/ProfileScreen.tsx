"use client";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";

const ProfileScreen = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
  };

  const renderSettingItem = (
    icon: any,
    title: string,
    subtitle: string,
    action: () => void,
    isSwitch = false,
    switchValue = false
  ) => (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
      onPress={action}
      activeOpacity={isSwitch ? 1 : 0.7}
    >
      <View 
        style={[styles.settingIcon, { backgroundColor: theme.colors.card }]}
      >
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: theme.colors.textLight }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={action}
          trackColor={{
            false: theme.colors.switchTrack,
            true: theme.colors.primary
          }}
          thumbColor={theme.colors.thumb}
        />
      ) : (
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={theme.colors.textLight} 
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen 
        options={{
          title: 'Profile',
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.profileCard}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || "U"}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user?.name || "User"}
          </Text>
          <Text style={[styles.userEmail, { color: theme.colors.textLight }]}>
            {user?.email || "user@example.com"}
          </Text>
          <TouchableOpacity
            style={[styles.editButton, { 
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.primary
            }]}
            onPress={() => router.push('/screens/EditProfileScreen')}
          >
            <Text style={[styles.editButtonText, { color: theme.colors.primary }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account
          </Text>
          {renderSettingItem(
            "grid-outline",
            "Categories",
            "Manage budget categories",
            () => router.push('/(tabs)/screens/CategoriesScreen')
          )}
          {renderSettingItem(
            "notifications-outline",
            "Notifications",
            "Budget alerts settings",
            () => router.push('/(tabs)/screens/NotificationsScreen')
          )}
          {renderSettingItem(
            "download-outline",
            "Export Reports",
            "Export expense data as CSV or PDF",
            () => router.push('/(tabs)/screens/ExportReportsScreen')
          )}
        </View>

        <View style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Preferences
          </Text>
          {renderSettingItem(
            "moon-outline",
            "Dark Mode",
            themeMode === 'dark' ? "Dark mode enabled" : "Light mode enabled",
            toggleTheme,
            true,
            themeMode === 'dark'
          )}
          {renderSettingItem("globe-outline", "Language", "English", () => {})}
          {renderSettingItem("cash-outline", "Currency", "NGN", () => {})}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    margin: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowOpacity: 0,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 16,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    alignSelf: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingsSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  logoutText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 10,
    fontSize: 16,
  },
});

export default ProfileScreen;

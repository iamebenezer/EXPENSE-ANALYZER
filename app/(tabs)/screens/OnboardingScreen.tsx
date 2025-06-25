"use client";

import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../../context/ThemeContext";

const { width } = Dimensions.get("window");

interface Slide {
  id: string;
  title: string;
  description: string;
  image: any; // or more specific type if available
}

const slides: Slide[] = [
  {
    id: "1",
    title: "Track Your Expenses",
    description: "Keep track of your daily expenses and income with ease.",
    image: require("../../../assets/images/logo.png"),
  },
  {
    id: "2",
    title: "Set Budgets",
    description:
      "Create budgets for different categories and stay on top of your spending.",
    image: require("../../../assets/images/logo.png"),
  },
  {
    id: "3",
    title: "Visualize Your Finances",
    description:
      "Get insights into your spending habits with beautiful charts and reports.",
    image: require("../../../assets/images/logo.png"),
  },
];

const OnboardingScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const router = useRouter();
  const { theme } = useTheme();

  const renderItem = ({ item }: { item: Slide }) => {
    return (
      <View style={[styles.slide, { width }]}>
        <Image source={item.image} style={styles.image} />
        <Text style={[styles.title, { color: theme.colors.primary }]}>
          {item.title}
        </Text>
        <Text style={[styles.description, { color: theme.colors.textLight }]}>
          {item.description}
        </Text>
      </View>
    );
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.push("/(tabs)/screens/LoginScreen");
    }
  };

  const handleSkip = () => {
    router.push("/(tabs)/screens/LoginScreen");
  };

  const updateCurrentSlideIndex = (e: {
    nativeEvent: { contentOffset: { x: any } };
  }) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentIndex(currentIndex);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={[styles.skipText, { color: theme.colors.textLight }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={updateCurrentSlideIndex}
        keyExtractor={(item) => item.id}
      />

      <View style={styles.indicatorContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              {
                backgroundColor:
                  index === currentIndex
                    ? theme.colors.primary
                    : theme.colors.border,
              },
            ]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleNext}
      >
        <Text style={styles.buttonText}>
          {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    alignItems: "flex-end",
    padding: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  image: {
    width: width * 0.8,
    height: width * 0.8,
    resizeMode: "contain",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 30,
  },
  indicator: {
    height: 8,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 30,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default OnboardingScreen;

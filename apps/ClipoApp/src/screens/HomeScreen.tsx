import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withDelay,
  interpolate,
  Extrapolate,
  runOnJS
} from 'react-native-reanimated';
import { Play, Sparkles, Zap, Music, SquareScissorsIcon } from 'lucide-react-native';
import colors from '../constants/colors';
import UploadVideoButton from '../components/HomeScreen/UploadVideoButton';
import { s, vs, ms } from 'react-native-size-matters';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const HomeScreen = () => {
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const subtitleOpacity = useSharedValue(0);
  const uploadCardScale = useSharedValue(0.8);
  const uploadCardOpacity = useSharedValue(0);
  const featuresOpacity = useSharedValue(0);
  const featuresTranslateY = useSharedValue(50);

  const features = [
    {
      icon: <Sparkles size={20} color={colors.textPrimary} />,
      title: 'Auto-caption',
      description: 'On device caption generation',
      delay: 0
    },
    {
      icon: <SquareScissorsIcon size={20} color={colors.textPrimary} />,
      title: 'Timeline',
      description: 'Professional grade trimming',
      delay: 100
    },
    {
      icon: <Zap size={20} color={colors.textPrimary} />,
      title: 'Fast Export',
      description: 'Export in multiple formats quickly',
      delay: 200
    },
    {
      icon: <Music size={20} color={colors.textPrimary} />,
      title: 'Add music',
      description: 'Add your faviourite music',
      delay: 300
    }
  ];

  useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 800 });
    titleTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    subtitleOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    uploadCardOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
    uploadCardScale.value = withDelay(600, withSpring(1, { damping: 12, stiffness: 100 }));
    featuresOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    featuresTranslateY.value = withDelay(1000, withSpring(0, { damping: 15, stiffness: 120 }));
  }, []);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const uploadCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: uploadCardOpacity.value,
    transform: [{ scale: uploadCardScale.value }],
  }));

  const featuresAnimatedStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
    transform: [{ translateY: featuresTranslateY.value }],
  }));

  const FeatureCard = ({ feature, index }) => {
    const cardScale = useSharedValue(1);
    const cardOpacity = useSharedValue(0);
    
    useEffect(() => {
      cardOpacity.value = withDelay(1200 + feature.delay, withTiming(1, { duration: 500 }));
    }, []);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
      transform: [{ scale: cardScale.value }],
    }));

    const handlePressIn = () => {
      cardScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
      cardScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    return (
      <AnimatedTouchableOpacity
        style={[styles.featureCard, cardAnimatedStyle]}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.featureIcon}>
          {feature.icon}
        </View>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>
          {feature.description}
        </Text>
      </AnimatedTouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.heroSection}>
        <View style={styles.headerContainer}>
          <Animated.Text style={[styles.title, titleAnimatedStyle]}>
            Clipo
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
            Professional Video Editing
          </Animated.Text>
          <Animated.Text style={[styles.tagline, subtitleAnimatedStyle]}>
            Create stunning videos with powerful editing tools
          </Animated.Text>
        </View>

        <Animated.View style={[styles.uploadSection, uploadCardAnimatedStyle]}>
          <View style={styles.uploadContainer}>
            <Text style={styles.uploadTitle}>Get Started</Text>
            <Text style={styles.uploadDescription}>
              Import your video to start editing
            </Text>
            <UploadVideoButton />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.featuresSection, featuresAnimatedStyle]}>
        <Text style={styles.featuresTitle}>What You Can Do</Text>
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </View>
      </Animated.View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default HomeScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroSection: {
    paddingTop: vs(60),
    paddingHorizontal: s(24),
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: vs(40),
  },
  title: {
    fontSize: ms(36),
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: vs(8),
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: ms(18),
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: vs(8),
  },
  tagline: {
    fontSize: ms(16),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: ms(22),
    paddingHorizontal: s(20),
  },
  uploadSection: {
    width: '100%',
    marginBottom: vs(50),
  },
  uploadContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: s(20),
    padding: s(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadTitle: {
    fontSize: ms(20),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: vs(8),
  },
  uploadDescription: {
    fontSize: ms(14),
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: vs(20),
    lineHeight: ms(20),
  },
  featuresSection: {
    paddingHorizontal: s(24),
    marginBottom: vs(40),
  },
  featuresTitle: {
    fontSize: ms(24),
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: vs(24),
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: s(16),
    padding: s(20),
    alignItems: 'center',
    marginBottom: vs(16),
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    width: s(40),
    height: s(40),
    backgroundColor: colors.background,
    borderRadius: s(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureTitle: {
    fontSize: ms(14),
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: vs(4),
  },
  featureDescription: {
    fontSize: ms(12),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: ms(16),
  },
  bottomSpacing: {
    height: vs(40),
  },
});
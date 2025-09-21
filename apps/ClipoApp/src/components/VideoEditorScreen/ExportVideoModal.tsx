import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import {
  X,
  Download,
  Music,
  Scissors,
  Image,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle,
  FileText,
  Clock,
} from 'lucide-react-native';
import useExportVideo from '../../hooks/useExportVideo';
import colors from '../../constants/colors';

const { width: screenWidth } = Dimensions.get('window');

interface ExportVideoModalProps {
  visible: boolean;
  onClose: () => void;
}

const ExportVideoModal: React.FC<ExportVideoModalProps> = ({ visible, onClose }) => {
  const {
    isExporting,
    progress,
    exportResult,
    exportVideo,
    resetExport,
  } = useExportVideo();

  const [animatedProgress] = useState(new Animated.Value(0));
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (progress) {
      Animated.timing(animatedProgress, {
        toValue: progress.progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress?.progress]);

  useEffect(() => {
    if (exportResult && !isExporting) {
      setShowResult(true);
    }
  }, [exportResult, isExporting]);


  useEffect(() => {
    if (visible && !isExporting) {
      setShowResult(false);
      resetExport();
    }
  }, [visible]);

  const handleStartExport = async () => {
    try {
      await exportVideo();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleClose = () => {
    if (isExporting) {
      Alert.alert(
        'Export in Progress',
        'Export is currently running. Are you sure you want to cancel?',
        [
          { text: 'Continue Export', style: 'cancel' },
          {
            text: 'Cancel Export',
            style: 'destructive',
            onPress: () => {
              resetExport();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const getStageIcon = () => {
    if (!progress) return <Download size={24} color="#007AFF" />;

    switch (progress.stage) {
      case 'preparing':
        return <Clock size={24} color="#FF9500" />;
      case 'audio':
        return <Music size={24} color="#007AFF" />;
      case 'trim':
        return <Scissors size={24} color="#007AFF" />;
      case 'overlay':
        return <Image size={24} color="#007AFF" />;
      case 'finalizing':
        return <FileText size={24} color="#007AFF" />;
      case 'complete':
        return <CheckCircle size={24} color="#4CAF50" />;
      case 'error':
        return <XCircle size={24} color="#F44336" />;
      default:
        return <Loader size={24} color="#007AFF" />;
    }
  };

  const getResultIcon = () => {
    if (!exportResult) return null;
    
    return exportResult.success ? (
      <CheckCircle size={48} color="#4CAF50" />
    ) : (
      <XCircle size={48} color="#F44336" />
    );
  };

  const renderInitialView = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Download size={32} color="#007AFF" />
        <Text style={styles.title}>Export Video</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <X size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.description}>
        <Text style={styles.descriptionText}>
          Ready to export your edited video. This will process all your edits and create the final video file.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleClose}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleStartExport}
        >
          <Download size={20} color="white" />
          <Text style={styles.exportButtonText}>Start Export</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProgressView = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        {getStageIcon()}
        <Text style={styles.title}>Exporting Video</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          {/* <X size={24} color={colors.textPrimary} /> */}
        </TouchableOpacity>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressMessage}>
            {progress?.message || 'Processing...'}
          </Text>
          <Text style={styles.progressSteps}>
            Step {progress?.currentStep || 0} of {progress?.totalSteps || 0}
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: animatedProgress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressPercentage}>
            {progress?.progress || 0}%
          </Text>
        </View>
      </View>

      <View style={styles.statusInfo}>
        <View style={styles.statusItem}>
          <Loader size={16} color="#007AFF" />
          <Text style={styles.statusText}>
            Please keep the app open while exporting
          </Text>
        </View>
      </View>
    </View>
  );

  const renderResultView = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        {getResultIcon()}
        <Text style={styles.title}>
          {exportResult?.success ? 'Export Complete' : 'Export Failed'}
        </Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <X size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.resultSection}>
        {exportResult?.success ? (
          <View>
            <Text style={styles.successMessage}>
              Your video has been exported successfully!
            </Text>
            {exportResult.finalPath && (
              <View style={styles.pathContainer}>
                <Text style={styles.pathLabel}>Saved to:</Text>
                <Text style={styles.pathText} numberOfLines={2}>
                  {exportResult.finalPath}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.errorMessage}>
              Export failed. Please try again.
            </Text>
            {exportResult?.error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#F44336" />
                <Text style={styles.errorText}>
                  {exportResult.error}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {exportResult?.success ? (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleStartExport}
            >
              <Download size={20} color="white" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderContent = () => {
    if (showResult) {
      return renderResultView();
    } else if (isExporting) {
      return renderProgressView();
    } else {
      return renderInitialView();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    width: Math.min(screenWidth - 40, 400),
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#666',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressMessage: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressSteps: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  statusInfo: {
    marginBottom: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  resultSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  errorMessage: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  pathContainer: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  pathLabel: {
    fontSize: 12,
    color: colors.textPrimary,
    marginBottom: 4,
    fontWeight: '500',
  },
  pathText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  exportButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  retryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#FF9500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default ExportVideoModal;
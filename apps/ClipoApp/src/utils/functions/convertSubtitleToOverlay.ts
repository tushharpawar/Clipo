import colors from "../../constants/colors";

const subtitleToOverlayConfig = (subtitleSegments: [], overlayConfig:{}) => {
    const defaultConfig = {
        fontSize: 20,
        color: "#FFFFFF",
        backgroundColor: "#000000",
        opacity: 1,
        alignment: "center",
        maxWidth: 0.8,
        highlightColor: colors.highlight,
        x: -1, 
        y: -1  
        };

        const finalConfig = { ...defaultConfig, ...overlayConfig };

        const subtitleOverlays = subtitleSegments.map(segment => {
        const highlightWords = segment.words.map(wordObj => ({
            word: wordObj.word,
            startTimeMs: wordObj.startTime,
            endTimeMs: wordObj.endTime,
            highlightColor: finalConfig.highlightColor,
        }));

        return {
            text: segment.text,
            startTimeMs: segment.startTime,
            endTimeMs: segment.endTime,
            x: finalConfig.x,
            y: finalConfig.y,
            fontSize: finalConfig.fontSize,
            color: finalConfig.color,
            opacity: finalConfig.opacity,
            highlightWords: highlightWords,
            alignment: finalConfig.alignment,
            strokeColor: finalConfig.strokeColor,
            strokeWidth: finalConfig.strokeWidth,
            maxWidth: finalConfig.maxWidth
        };
    });

    return { ...overlayConfig, subtitleOverlays };
}

export default subtitleToOverlayConfig;
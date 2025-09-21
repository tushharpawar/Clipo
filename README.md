# 🎬 Clipo – Video Editing Application

Clipo is a **React Native video editing application** built in a **monorepo structure** with separate `app` and `packages`.  
It showcases advanced React Native capabilities, native Android integrations, and smooth UI/UX for mobile video editing.  

---

## ✨ Features

- 📦 **Monorepo Architecture** – app + custom `VideoProcessor` package for modular development.  
- ✂️ **Video Processing** – trim videos, add overlays, and manage audio (add/remove) using Android’s low-level libraries (**MediaMuxer**, **MediaCodec**).  
- 📝 **On-device Captions** – integrated **OpenAI Whisper model** to automatically generate captions and sync them with video.  
- 📤 **Export Pipeline** – export edited videos efficiently on device.  
- 🎛️ **Timeline UI** – interactive trimming controls with **React Native Reanimated** for smooth gestures and animations.  
- ⚡ **Native Bridging** – bridged native Android APIs with React Native for high-performance video editing beyond standard JS libraries.  

---

## 📱 Demo

- **Demo Video:** [Watch Demo](https://drive.google.com/file/d/1h2Hp8rEJhpkrNe28xfTagNB_7ymZXttl/view?usp=drive_link)  

---

## 🚀 Tech Stack

- **React Native CLI**  
- **Android Native (MediaMuxer, MediaCodec)**  
- **React Native Reanimated** (gestures & animations)  
- **OpenAI Whisper (on-device)** for captions  
- **Monorepo setup** with Yarn Workspaces  

---

## 🛠️ Packages

### `VideoProcessor`
Custom React Native package exposing core video editing capabilities:  
- `trimVideo()`  
- `addOverlay()`  
- `addSound()`  
- `removeSound()`  

---

## 💡 About

Clipo is a **personal project** created to explore the limits of React Native by integrating low-level Android APIs, building reusable packages, and experimenting with on-device ML. It demonstrates skills in bridging native functionality with React Native while maintaining smooth, user-friendly experiences.  


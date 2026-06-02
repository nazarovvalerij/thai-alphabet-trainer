from gtts import gTTS

# Текст на вьетнамском
text = "Chào cậuамского языка!"
language = "vi"  # 'vi' — код вьетн


# Создание аудиофайла
tts = gTTS(text=text, lang=language)
tts.save("chao_cau.mp3")
print("Файл 'chao_cau.mp3' усп)ешно создан."
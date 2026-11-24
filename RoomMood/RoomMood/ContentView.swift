//
//  ContentView.swift
//  RoomMood
//
//  Created by MarcoRSP on 07.07.26.
//

import SwiftUI
import PhotosUI
import UIKit

// MARK: - Datenmodelle
struct WGMember: Identifiable {
    let id = UUID()
    var name: String
    var initials: String       // Füge das wieder hinzu
    var avatarImage: UIImage?  // Das für das Foto
    var color: Color
}

struct AvatarPickerView: View {
    @Binding var selectedImage: UIImage?
    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        PhotosPicker(selection: $pickerItem, matching: .images) {
            if let image = selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 60, height: 60)
                    .clipShape(Circle())
            } else {
                // Platzhalter, falls noch kein Bild da ist
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 60, height: 60)
                    .overlay(Image(systemName: "camera.fill"))
            }
        }
        .onChange(of: pickerItem) { newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    selectedImage = uiImage
                }
            }
        }
    }
}
func uploadAvatar(image: UIImage) {
    // 1. Komprimieren (WICHTIG: nicht das Originalbild senden, sonst wird es zu groß!)
    guard let jpegData = image.jpegData(compressionQuality: 0.5) else { return }
    
    // 2. Base64-String erzeugen
    let base64String = jpegData.base64EncodedString()
    
    // 3. An Pi senden (Dein existierender NetworkManager)
    let payload = ["avatar_data": base64String]
    NetworkManager.shared.postData(endpoint: "/upload/avatar", data: payload)
}

struct Room: Identifiable {
    let id = UUID()
    var name: String
    var cleanliness: String
    var comment: String
    var icon: String
    var color: Color
}

// Feedback-Gefühl innerhalb eines Mood-Raums
struct MemberMood: Identifiable {
    let id = UUID()
    var name: String
    var moodEmoji: String // Rein das Gefühls-Emoji als Feedback
}

struct MoodRoom: Identifiable {
    let id = UUID()
    var name: String      // Rein textlicher Name ohne Emoji
    var note: String
    var memberMoods: [MemberMood] = []
}

struct Chore: Identifiable {
    let id = UUID()
    var title: String
    var assignee: String
    var isDone: Bool
    var frequency: String
}


// Funktionierendes Modell für WG-Tasks mit Erstellungs- und Fälligkeitsdatum
struct GeneralTask: Identifiable {
    let id = UUID()
    var title: String
    var dueDate: Date
    var createdAt: Date = Date()
    var isDone: Bool = false
    
    // Berechnet, wie viele Tage der Task bereits aktiv im System ist (Druck-Faktor)
    var daysActive: Int {
        let calendar = Calendar.current
        let startOfCreation = calendar.startOfDay(for: createdAt)
        let startOfToday = calendar.startOfDay(for: Date())
        let components = calendar.dateComponents([.day], from: startOfCreation, to: startOfToday)
        return max(0, components.day ?? 0)
    }
}

struct CalendarEvent: Identifiable {
    let id = UUID()
    var title: String
    var person: String
    var startDate: Date
    var endDate: Date
    
    var color: Color {
        switch person {
        case "Du": return .green
        case "Partner A": return .blue
        case "Partner B": return .purple
        default: return Color(red: 54/255, green: 73/255, blue: 64/255)
        }
    }
}

// MARK: - Die Haupt-View deiner App
struct ContentView: View {
    var body: some View {
        MainContentView()
    }
}
// WG-Mitgliederansicht
struct WGMemberView: View {
    let member: WGMember
    
    var body: some View {
        VStack {
            Text(member.initials)
                .font(.headline)
                .foregroundColor(.white)
                .frame(width: 45, height: 45)
                .background(member.color)
                .clipShape(Circle())
            
            Text(member.name)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}
// MARK: - Die Kontroll-View
struct MainContentView: View {
    @State private var isStartingPageActive = true
    @State private var isUserRegistered = false
    
    @State private var userName = ""
    @State private var homeName = ""
    @State private var homeCode = ""
    
    var body: some View {
        ZStack {
            if isStartingPageActive {
                RoomMoodStartingPage()
                    .transition(.opacity)
            } else if !isUserRegistered {
                RegistrationView(
                    userName: $userName,
                    homeName: $homeName,
                    homeCode: $homeCode,
                    isRegistered: $isUserRegistered
                )
                .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .opacity))
            } else {
                TabView {
                    WGDashboardView(userName: userName, homeName: homeName, homeCode: homeCode)
                        .tabItem { Label("Dashboard", systemImage: "house.fill") }
                    
                    ChoreAndTaskListView()
                        .tabItem { Label("To-dos", systemImage: "checkmark.circle.fill") }
                    
                    ShoppingListView()
                        .tabItem { Label("Einkauf", systemImage: "cart.fill") }
                    
                    WGCalendarView(userName: userName)
                        .tabItem { Label("Kalender", systemImage: "calendar") }
                }
                .tint(Color(red: 54/255, green: 73/255, blue: 64/255))
                .transition(.opacity)
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(.easeOut(duration: 0.5)) {
                    isStartingPageActive = false
                }
            }
        }
    }
}

// MARK: - Die Startseite
struct RoomMoodStartingPage: View {
    var body: some View {
        ZStack {
            Color(red: 250/255, green: 248/255, blue: 245/255).ignoresSafeArea()
            VStack(spacing: 40) {
                Spacer()
                Image("roommood_logo")
                    .resizable().scaledToFit().frame(width: 280, height: 280)
                Text("See each other's mood, build empathy, and live better together.")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundColor(Color(red: 54/255, green: 73/255, blue: 64/255).opacity(0.8))
                    .fontWeight(.semibold).multilineTextAlignment(.center).padding(.horizontal, 44)
                Spacer()
                ProgressView().tint(Color(red: 54/255, green: 73/255, blue: 64/255))
            }
        }
    }
}

// MARK: - Die Anmeldeseite
struct RegistrationView: View {
    @Binding var userName: String
    @Binding var homeName: String
    @Binding var homeCode: String
    @Binding var isRegistered: Bool
    
    @State private var registrationMode = 0
    @State private var enteredCode = ""
    
    private let logoColor = Color(red: 54/255, green: 73/255, blue: 64/255)
    
    func generateRandomCode() -> String {
        let letters = "abcdefghijklmnopqrstuvwxyz"
        let randomPrefix = String((0..<3).map { _ in letters.randomElement()! }).uppercased()
        let randomNumber = Int.random(in: 1000...9999)
        return "\(randomPrefix)-\(randomNumber)"
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 250/255, green: 248/255, blue: 245/255).ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        Image("roommood_logo")
                            .resizable().scaledToFit().frame(width: 90, height: 90).padding(.top, 20)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Herzlich Willkommen!")
                                .font(.system(.title2, design: .rounded)).bold().foregroundColor(logoColor)
                            Text("Richten wir dein Profil für dein Zuhause ein.")
                                .font(.subheadline).foregroundColor(logoColor.opacity(0.7))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Wie heißt du?").font(.caption.bold()).foregroundColor(logoColor.opacity(0.8))
                            TextField("Dein Name (z.B. Laura)", text: $userName)
                                .padding().background(Color(.secondarySystemBackground)).cornerRadius(12)
                        }.padding(.horizontal, 24)
                        
                        Picker("Modus", selection: $registrationMode) {
                            Text("🏠 Neue WG gründen").tag(0)
                            Text("🔑 WG beitreten").tag(1)
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 24)
                        
                        if registrationMode == 0 {
                            VStack(alignment: .leading, spacing: 14) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Wie soll deine Unterkunft heißen?").font(.caption.bold()).foregroundColor(logoColor.opacity(0.8))
                                    TextField("Name deiner WG (z.B. Altbau-Liebe)", text: $homeName)
                                        .padding().background(Color(.secondarySystemBackground)).cornerRadius(12)
                                }
                            }
                            .padding(.horizontal, 24)
                        } else {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("WG-Code eingeben").font(.caption.bold()).foregroundColor(logoColor.opacity(0.8))
                                TextField("z.B. CBG-1024", text: $enteredCode)
                                    .padding().background(Color(.secondarySystemBackground)).cornerRadius(12)
                                    .autocorrectionDisabled()
                                    .textInputAutocapitalization(.characters)
                            }
                            .padding(.horizontal, 24)
                        }
                        
                        Spacer(minLength: 40)
                        
                        Button {
                            if registrationMode == 0 {
                                homeCode = generateRandomCode()
                            } else {
                                homeCode = enteredCode.uppercased()
                                homeName = "WG"
                            }
                            withAnimation(.easeInOut(duration: 0.5)) { isRegistered = true }
                        } label: {
                            Text(registrationMode == 0 ? "WG gründen & starten 🏠" : "Code prüfen & beitreten 🔑")
                                .font(.headline).foregroundColor(.white)
                                .frame(maxWidth: .infinity).frame(height: 54)
                                .background(isButtonDisabled ? logoColor.opacity(0.4) : logoColor)
                                .cornerRadius(16)
                        }
                        .disabled(isButtonDisabled)
                        .padding(.horizontal, 24)
                    }
                }
            }
        }
    }
    private var isButtonDisabled: Bool {
        if userName.isEmpty { return true }
        return registrationMode == 0 ? homeName.isEmpty : enteredCode.isEmpty
    }
}

// MARK: - Tab 1: Das Dashboard (MIT REINEM EMOTION-EMOJI FEEDBACK)
struct WGDashboardView: View {
    let userName: String
    let homeName: String
    let homeCode: String
    
    @State private var members = [
        WGMember(name: "Du", initials: "MA", color: .green),
        WGMember(name: "Partner A", initials: "LA", color: .blue),
        WGMember(name: "Partner B", initials: "TM", color: .purple)
    ]
    @State private var myEmoji = "😎"
    @State private var myStatus = "Entspannt"
    @State private var myLocationEmoji = "🏠"
    @State private var myLocationText = "Zuhause"
    
    @State private var rooms: [Room] = [
        Room(name: "Küche", cleanliness: "Akzeptabel", comment: "Mülleimer voll", icon: "sink.fill", color: .orange),
        Room(name: "Badezimmer", cleanliness: "Blitzblank", comment: "Frische Handtücher liegen bereit", icon: "shower.fill", color: .green)
    ]
    
    // Mood-Räume ohne Symbole im Namen
    @State private var moodRooms: [MoodRoom] = [
        MoodRoom(name: "Gemeinschafts-Klima", note: "Wie wohl fühlen wir uns gerade im Zusammenleben?", memberMoods: [
            MemberMood(name: "Partner A", moodEmoji: "😊")
        ]),
        MoodRoom(name: "Sauberkeits-Vibe", note: "Zufriedenheit mit der Ordnung", memberMoods: [
            MemberMood(name: "Partner B", moodEmoji: "🚨")
        ])
    ]
    
    @State private var showingEditMoodSheet = false
    @State private var showingAddMoodRoomSheet = false
    @State private var showingAddRoomSheet = false
    @State private var selectedRoomForEdit: Room? = nil
    @State private var selectedMoodRoomForEdit: MoodRoom? = nil
    @State private var selectedMoodRoomForExpress: MoodRoom? = nil
    
    let generalEmojis = ["😎", "😊", "😴", "☕️", "🥳", "😭", "😤", "🍕", "✨", "🧹", "🧼", "🚨"]
    private let locationEmojis = ["🏠", "🏢", "🎓", "🏋️‍♂️", "🛌", "🚂", "🍻", "📍"]
    
    @State private var tempEmoji = "😎"
    @State private var tempStatus = ""
    @State private var tempLocationEmoji = "🏠"
    @State private var tempLocationText = ""
    
    @State private var newMoodRoomName = ""
    @State private var newMoodRoomNote = ""
    
    @State private var editMoodRoomName = ""
    @State private var editMoodRoomNote = ""
    
    @State private var userFeedbackEmoji = "😊"
    
    @State private var newRoomName = ""
    @State private var newRoomCleanliness = "Sauber"
    @State private var newRoomComment = ""
    @State private var newRoomIcon = "house.fill"
    @State private var newRoomColor = Color.blue
    
    @State private var editRoomName = ""
    @State private var editRoomCleanliness = ""
    @State private var editRoomComment = ""
    
    private let logoColor = Color(red: 54/255, green: 73/255, blue: 64/255)
    private let availableIcons = ["sink.fill", "shower.fill", "bed.double.fill", "tv.fill", "sofa.fill", "refrigerator.fill", "house.fill"]
    private let availableColors: [Color] = [.orange, .green, .blue, .purple, .pink, .red, .teal]
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Unser Zuhause").font(.subheadline).foregroundColor(.secondary)
                            Text("\(homeName) (\(homeCode)) 🏠").font(.title2.bold()).foregroundColor(logoColor)
                        }
                        Spacer()
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 15) {
                            ForEach(members) { member in
                                WGMemberView(member: member)
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.bottom, 10)
                    .padding(.horizontal)
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Unser Zuhause").font(.subheadline).foregroundColor(.secondary)
                            Text("\(homeName) (\(homeCode)) 🏠").font(.title2.bold()).foregroundColor(logoColor)
                        }
                    }.padding(.horizontal)
                    
                    Button {
                        tempEmoji = myEmoji; tempStatus = myStatus
                        tempLocationEmoji = myLocationEmoji; tempLocationText = myLocationText
                        showingEditMoodSheet = true
                    } label: {
                        ExtendedMoodView(name: userName, moodEmoji: myEmoji, status: myStatus, locationEmoji: myLocationEmoji, locationText: myLocationText).padding(.horizontal)
                    }.buttonStyle(.plain)
                    
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("Physische Räume").font(.headline.bold())
                            Spacer()
                            Button { showingAddRoomSheet = true } label: {
                                HStack(spacing: 4) { Image(systemName: "plus.circle.fill"); Text("Hinzufügen").font(.subheadline.bold()) }
                            }.foregroundColor(logoColor)
                        }.padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            if rooms.isEmpty {
                                Text("Keine physischen Räume angelegt.").font(.caption).foregroundColor(.secondary).padding()
                            } else {
                                ForEach(rooms) { room in
                                    Button {
                                        selectedRoomForEdit = room
                                        editRoomName = room.name
                                        editRoomCleanliness = room.cleanliness
                                        editRoomComment = room.comment
                                    } label: {
                                        CustomRoomRowView(room: room)
                                    }.buttonStyle(.plain)
                                }
                            }
                        }.padding(.horizontal)
                    }
                    
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("WG-Vibe & Mood-Räume").font(.headline.bold())
                            Spacer()
                            Button { showingAddMoodRoomSheet = true } label: {
                                HStack(spacing: 4) { Image(systemName: "plus.circle.fill"); Text("Erstellen").font(.subheadline.bold()) }
                            }.foregroundColor(logoColor)
                        }.padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            if moodRooms.isEmpty {
                                Text("Keine aktiven Mood-Räume.").font(.caption).foregroundColor(.secondary).padding()
                            } else {
                                ForEach(moodRooms) { moodRoom in
                                    CustomMoodRoomRowView(
                                        moodRoom: moodRoom,
                                        currentUserName: userName,
                                        onDelete: {
                                            if let index = moodRooms.firstIndex(where: { $0.id == moodRoom.id }) {
                                                // Hier ist 'withAnimation' ein Funktionsaufruf mit einem Closure-Block { ... }
                                                withAnimation {
                                                    moodRooms.remove(at: index)
                                                }
                                            }
                                        },
                                        onEdit: {
                                            selectedMoodRoomForEdit = moodRoom
                                            editMoodRoomName = moodRoom.name
                                            editMoodRoomNote = moodRoom.note
                                        },
                                        onExpressMood: {
                                            selectedMoodRoomForExpress = moodRoom
                                            if let existing = moodRoom.memberMoods.first(where: { $0.name == userName }) {
                                                userFeedbackEmoji = existing.moodEmoji
                                            } else {
                                                userFeedbackEmoji = "😊"
                                            }
                                        },
                                        onLeaveRoom: {
                                            if let index = moodRooms.firstIndex(where: { $0.id == moodRoom.id }) {
                                                moodRooms[index].memberMoods.removeAll(where: { $0.name == userName })
                                            }
                                        }
                                    )
                                }
                            }
                        }.padding(.horizontal)
                    }
                }.padding(.vertical)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Dashboard")
            .sheet(isPresented: $showingEditMoodSheet) {
                NavigationStack {
                    Form {
                        Section("Wie fühlst du dich heute?") {
                            HStack {
                                Picker("Vibe", selection: $tempEmoji) { ForEach(generalEmojis, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)
                                TextField("Stimmung eingeben", text: $tempStatus)
                            }
                        }
                        Section("Wo bist du gerade?") {
                            HStack {
                                Picker("Ort", selection: $tempLocationEmoji) { ForEach(locationEmojis, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)
                                TextField("z.B. Arbeit, Uni", text: $tempLocationText)
                            }
                        }
                    }
                    .navigationTitle("Mein Vibe-Check")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                myEmoji = tempEmoji; myStatus = tempStatus
                                myLocationEmoji = tempLocationEmoji; myLocationText = tempLocationText
                                showingEditMoodSheet = false
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddRoomSheet) {
                NavigationStack {
                    Form {
                        Section("Raum-Details") {
                            TextField("Name des Raums (z.B. Flur, Wohnzimmer)", text: $newRoomName)
                            TextField("Aktueller Zustand (z.B. Sauber, Unordentlich)", text: $newRoomCleanliness)
                            TextField("Notiz / Kommentar (Optional)", text: $newRoomComment)
                        }
                        Section("Design") {
                            Picker("Icon", selection: $newRoomIcon) {
                                ForEach(availableIcons, id: \.self) { icon in
                                    Image(systemName: icon).tag(icon)
                                }
                            }.pickerStyle(.menu)
                            
                            Picker("Farbe", selection: $newRoomColor) {
                                ForEach(availableColors, id: \.self) { color in
                                    Text(color.description.capitalized).tag(color)
                                }
                            }.pickerStyle(.menu)
                        }
                    }
                    .navigationTitle("Raum hinzufügen")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Abbrechen") { showingAddRoomSheet = false }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Hinzufügen") {
                                let room = Room(name: newRoomName, cleanliness: newRoomCleanliness, comment: newRoomComment, icon: newRoomIcon, color: newRoomColor)
                                rooms.append(room)
                                newRoomName = ""; newRoomCleanliness = "Sauber"; newRoomComment = ""; newRoomIcon = "house.fill"; newRoomColor = .blue
                                showingAddRoomSheet = false
                            }.disabled(newRoomName.isEmpty)
                        }
                    }
                }
            }
            .sheet(item: $selectedRoomForEdit) { room in
                NavigationStack {
                    Form {
                        Section("Name") { TextField("Raumname", text: $editRoomName) }
                        Section("Zustand von \(room.name)") { TextField("z.B. Sauber", text: $editRoomCleanliness) }
                        Section("Notiz / Kommentar") { TextField("z.B. Müll müsste raus", text: $editRoomComment) }
                    }
                    .navigationTitle("\(room.name) bearbeiten")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                if let index = rooms.firstIndex(where: { $0.id == room.id }) {
                                    rooms[index].name = editRoomName
                                    rooms[index].cleanliness = editRoomCleanliness
                                    rooms[index].comment = editRoomComment
                                }
                                selectedRoomForEdit = nil
                            }
                        }
                    }
                }
            }
            .sheet(item: $selectedMoodRoomForEdit) { moodRoom in
                NavigationStack {
                    Form {
                        Section("Name") {
                            TextField("Name des Raums", text: $editMoodRoomName)
                        }
                        Section("Beschreibung / Notiz") {
                            TextField("Beschreibung", text: $editMoodRoomNote)
                        }
                    }
                    .navigationTitle("Mood-Raum bearbeiten")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Abbrechen") { selectedMoodRoomForEdit = nil }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                if let index = moodRooms.firstIndex(where: { $0.id == moodRoom.id }) {
                                    moodRooms[index].name = editMoodRoomName
                                    moodRooms[index].note = editMoodRoomNote
                                }
                                selectedMoodRoomForEdit = nil
                            }.disabled(editMoodRoomName.isEmpty)
                        }
                    }
                }
            }
            .sheet(item: $selectedMoodRoomForExpress) { moodRoom in
                NavigationStack {
                    Form {
                        Section("Wie nimmst du diesen Bereich gerade wahr?") {
                            Picker("Gefühls-Emoji wählen", selection: $userFeedbackEmoji) {
                                ForEach(generalEmojis, id: \.self) { Text($0).tag($0) }
                            }
                            .pickerStyle(.wheel)
                        }
                    }
                    .navigationTitle("Mein Vibe eintragen")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Abbrechen") { selectedMoodRoomForExpress = nil }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                if let index = moodRooms.firstIndex(where: { $0.id == moodRoom.id }) {
                                    if let moodIndex = moodRooms[index].memberMoods.firstIndex(where: { $0.name == userName }) {
                                        moodRooms[index].memberMoods[moodIndex].moodEmoji = userFeedbackEmoji
                                    } else {
                                        let newMood = MemberMood(name: userName, moodEmoji: userFeedbackEmoji)
                                        moodRooms[index].memberMoods.append(newMood)
                                    }
                                }
                                selectedMoodRoomForExpress = nil
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddMoodRoomSheet) {
                NavigationStack {
                    Form {
                        Section("Name der Situation / Bereich") { TextField("z.B. Sauberkeit Küche, Klausurenphase", text: $newMoodRoomName) }
                        Section("Beschreibung") { TextField("Kurzer Kommentar dazu...", text: $newMoodRoomNote) }
                    }
                    .navigationTitle("Mood-Raum erstellen")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Hinzufügen") {
                                moodRooms.append(MoodRoom(name: newMoodRoomName, note: newMoodRoomNote, memberMoods: []))
                                newMoodRoomName = ""; newMoodRoomNote = ""; showingAddMoodRoomSheet = false
                            }.disabled(newMoodRoomName.isEmpty)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Tab 2: Aufgaben & Pläne (PUTZPLAN & FUNKTIONIERENDE WG-TASKS)
struct ChoreAndTaskListView: View {
    @State private var selectedSegment = 0
    
    // Putzplan-Daten
    @State private var chores = [
        Chore(title: "Küche wischen", assignee: "Du", isDone: false, frequency: "Wöchentlich"),
        Chore(title: "Müll rausbringen", assignee: "Partner A", isDone: false, frequency: "Wöchentlich")
    ]
    @State private var newChoreTitle = ""
    @State private var newChoreAssignee = "Du"
    @State private var newChoreFrequency = "Wöchentlich"
    @State private var selectedChoreToEdit: Chore? = nil
    @State private var editChoreAssignee = "Du"
    @State private var editChoreFrequency = "Wöchentlich"
    @State private var editChoreTitle = ""
    
    // WG-Tasks Daten mit vollwertigem Hinzufügen, Löschen und "Aktiv seit"-Druckfaktor
    @State private var generalTasks = [
        GeneralTask(title: "GEZ Gebühren überweisen", dueDate: Date().addingTimeInterval(86400 * 3), createdAt: Calendar.current.date(byAdding: .day, value: -5, to: Date()) ?? Date()),
        GeneralTask(title: "Internet-Anbieter anrufen", dueDate: Date().addingTimeInterval(86400 * 1), createdAt: Calendar.current.date(byAdding: .day, value: -2, to: Date()) ?? Date())
    ]
    @State private var newGeneralTaskTitle = ""
    @State private var newGeneralTaskDueDate = Date()
    @State private var selectedGeneralTaskToEdit: GeneralTask? = nil
    @State private var editGeneralTaskTitle = ""
    @State private var editGeneralTaskDueDate = Date()
    
    var body: some View {
        NavigationStack {
            VStack {
                Picker("Kategorie", selection: $selectedSegment) {
                    Text("🧹 Putzplan").tag(0)
                    Text("📋 WG-Tasks").tag(1)
                }.pickerStyle(.segmented).padding()
                
                if selectedSegment == 0 {
                    VStack(spacing: 10) {
                        TextField("Neue Putzaufgabe...", text: $newChoreTitle).padding(12).background(Color(.secondarySystemBackground)).cornerRadius(12)
                        HStack {
                            Picker("Wer?", selection: $newChoreAssignee) {
                                Text("Du").tag("Du"); Text("Partner A").tag("Partner A"); Text("Partner B").tag("Partner B")
                            }.pickerStyle(.menu)
                            Spacer()
                            Picker("Intervall", selection: $newChoreFrequency) {
                                Text("Wöchentlich").tag("Wöchentlich"); Text("Einmalig").tag("Einmalig")
                            }.pickerStyle(.menu)
                            Button {
                                guard !newChoreTitle.isEmpty else { return }
                                chores.append(Chore(title: newChoreTitle, assignee: newChoreAssignee, isDone: false, frequency: newChoreFrequency))
                                newChoreTitle = ""
                            } label: { Image(systemName: "plus.circle.fill").font(.title2).foregroundColor(Color(red: 54/255, green: 73/255, blue: 64/255)) }
                        }
                    }.padding(.horizontal)
                    
                    List {
                        ForEach($chores) { $chore in
                            HStack {
                                Button { withAnimation { chore.isDone.toggle() } } label: { Image(systemName: chore.isDone ? "checkmark.circle.fill" : "circle").foregroundColor(chore.isDone ? .green : .secondary) }.buttonStyle(.plain)
                                VStack(alignment: .leading) {
                                    Text(chore.title).font(.body.bold()).strikethrough(chore.isDone).foregroundColor(chore.isDone ? .secondary : .primary)
                                    Text("👤 \(chore.assignee) • \(chore.frequency)").font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                                Button {
                                    selectedChoreToEdit = chore
                                    editChoreTitle = chore.title
                                    editChoreAssignee = chore.assignee
                                    editChoreFrequency = chore.frequency
                                } label: { Image(systemName: "pencil.circle").foregroundColor(.blue).font(.title3) }.buttonStyle(.plain)
                            }
                        }
                    }.listStyle(.insetGrouped)
                } else {
                    // WG-Tasks Bereich (Mit Hinzufügen, Löschen, Bearbeiten und Aktivitäts-Druck)
                    VStack(spacing: 12) {
                        TextField("Neuer WG-Task...", text: $newGeneralTaskTitle)
                            .padding(12)
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(12)
                        
                        HStack {
                            DatePicker("Fällig bis:", selection: $newGeneralTaskDueDate, displayedComponents: .date)
                                .labelsHidden()
                                .environment(\.locale, Locale(identifier: "de_DE"))
                            
                            Spacer()
                            
                            Button {
                                guard !newGeneralTaskTitle.isEmpty else { return }
                                let task = GeneralTask(title: newGeneralTaskTitle, dueDate: newGeneralTaskDueDate, createdAt: Date())
                                generalTasks.append(task)
                                newGeneralTaskTitle = ""
                                newGeneralTaskDueDate = Date()
                            } label: {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                    Text("Task anlegen")
                                }
                                .font(.subheadline.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(Color(red: 54/255, green: 73/255, blue: 64/255))
                                .cornerRadius(10)
                            }
                        }
                    }.padding(.horizontal)
                    
                    List {
                        ForEach($generalTasks) { $task in
                            HStack {
                                Button { withAnimation { task.isDone.toggle() } } label: {
                                    Image(systemName: task.isDone ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(task.isDone ? .green : .secondary)
                                }.buttonStyle(.plain)
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(task.title)
                                        .font(.body.bold())
                                        .strikethrough(task.isDone)
                                        .foregroundColor(task.isDone ? .secondary : .primary)
                                    
                                    HStack(spacing: 8) {
                                        Text("🗓️ Fällig: \(task.dueDate, style: .date)")
                                        
                                        if !task.isDone {
                                            Text("⏰ Seit \(task.daysActive) \(task.daysActive == 1 ? "Tag" : "Tagen") aktiv")
                                                .foregroundColor(task.daysActive > 3 ? .red : .orange)
                                                .bold()
                                        }
                                    }
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                HStack(spacing: 14) {
                                    Button {
                                        selectedGeneralTaskToEdit = task
                                        editGeneralTaskTitle = task.title
                                        editGeneralTaskDueDate = task.dueDate
                                    } label: {
                                        Image(systemName: "pencil.circle").foregroundColor(.blue).font(.title3)
                                    }.buttonStyle(.plain)
                                    
                                    Button {
                                        if let index = generalTasks.firstIndex(where: { $0.id == task.id }) {
                                            withAnimation { generalTasks.remove(at: index) }
                                        }
                                    } label: {
                                        Image(systemName: "trash").foregroundColor(.red).font(.subheadline)
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                    }.listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Aufgaben & Pläne")
            .sheet(item: $selectedChoreToEdit) { chore in
                NavigationStack {
                    Form {
                        Section("Aufgabe umbenennen") { TextField("Name", text: $editChoreTitle) }
                        Section("Details ändern") {
                            Picker("Zuständig", selection: $editChoreAssignee) { Text("Du").tag("Du"); Text("Partner A").tag("Partner A"); Text("Partner B").tag("Partner B") }
                            Picker("Häufigkeit", selection: $editChoreFrequency) { Text("Wöchentlich").tag("Wöchentlich"); Text("Einmalig").tag("Einmalig") }
                        }
                    }
                    .navigationTitle("Aufgabe bearbeiten")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                if let index = chores.firstIndex(where: { $0.id == chore.id }) {
                                    chores[index].title = editChoreTitle
                                    chores[index].assignee = editChoreAssignee
                                    chores[index].frequency = editChoreFrequency
                                }
                                selectedChoreToEdit = nil
                            }
                        }
                    }
                }
            }
            .sheet(item: $selectedGeneralTaskToEdit) { task in
                NavigationStack {
                    Form {
                        Section("Task-Inhalt") {
                            TextField("Bezeichnung", text: $editGeneralTaskTitle)
                        }
                        Section("Fälligkeit anpassen") {
                            DatePicker("Neues Datum", selection: $editGeneralTaskDueDate, displayedComponents: .date)
                                .environment(\.locale, Locale(identifier: "de_DE"))
                        }
                    }
                    .navigationTitle("Task bearbeiten")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Abbrechen") { selectedGeneralTaskToEdit = nil }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                if let index = generalTasks.firstIndex(where: { $0.id == task.id }) {
                                    generalTasks[index].title = editGeneralTaskTitle
                                    generalTasks[index].dueDate = editGeneralTaskDueDate
                                }
                                selectedGeneralTaskToEdit = nil
                            }.disabled(editGeneralTaskTitle.isEmpty)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Tab 3: Einkaufsliste
struct ShoppingListView: View {
    @State private var items: [ShoppingItem] = []
    @State private var newItemTitle = ""
    
    var body: some View {
        NavigationStack {
            VStack {
                // Eingabebereich
                HStack {
                    TextField("Produkt hinzufügen...", text: $newItemTitle)
                        .padding(12)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(12)
                    
                    Button {
                        guard !newItemTitle.isEmpty else { return }
                        let newItem = ShoppingItem(item_name: newItemTitle)
                        
                        // Lokal zur UI hinzufügen
                        items.insert(newItem, at: 0)
                        saveToLocal() // Sofort lokal sichern
                        
                        // An Pi senden
                        NetworkManager.shared.postData(endpoint: "/shopping/add", data: newItem)
                        newItemTitle = ""
                    } label: {
                        Text("Hinzufügen").bold().foregroundColor(.white)
                            .padding(.horizontal, 16).padding(.vertical, 12)
                            .background(Color(red: 54/255, green: 73/255, blue: 64/255))
                            .cornerRadius(12)
                    }
                }
                .padding([.horizontal, .top])
                
                List {
                    ForEach($items) { $item in
                        HStack {
                            Button {
                                withAnimation {
                                    item.isChecked.toggle()
                                    saveToLocal() // Statusänderung lokal speichern
                                }
                            } label: {
                                Image(systemName: item.isChecked ? "checkmark.square.fill" : "square")
                                    .foregroundColor(item.isChecked ? .green : .secondary)
                            }.buttonStyle(.plain)
                            
                            Text(item.item_name)
                                .strikethrough(item.isChecked)
                                .foregroundColor(item.isChecked ? .secondary : .primary)
                        }
                    }
                    .onDelete { indexSet in
                        items.remove(atOffsets: indexSet)
                        saveToLocal()
                    }
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Einkaufsliste 🛒")
            .onAppear {
                loadFromLocal() // Erst lokal laden
                fetchFromPi()   // Dann im Hintergrund aktualisieren
            }
        }
    }

    // MARK: - Helper Funktionen
    
    func saveToLocal() {
        if let encoded = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(encoded, forKey: "SavedShoppingList")
        }
    }
    
    func loadFromLocal() {
        if let data = UserDefaults.standard.data(forKey: "SavedShoppingList"),
           let decoded = try? JSONDecoder().decode([ShoppingItem].self, from: data) {
            self.items = decoded
        }
    }
    
    func fetchFromPi() {
        NetworkManager.shared.fetchItems { fetchedItems in
            // Auf den Main-Thread wechseln, um die UI zu aktualisieren
            DispatchQueue.main.async {
                self.items = fetchedItems
                self.saveToLocal()
            }
        }
    }
}

// MARK: - Tab 4: WG-Kalender & Urlaubsplaner (VISUELLE BALKEN + OPTIONALE UHRZEIT)
struct WGCalendarView: View {
    let userName: String
    @State private var currentMonthDate = Date()
    @State private var selectedDate = Date()
    
    @State private var events: [CalendarEvent] = [
        CalendarEvent(title: "Urlaub an der Ostsee 🏖️", person: "Partner A", startDate: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date(), endDate: Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()),
        CalendarEvent(title: "Heimatbesuch Familie 🚂", person: "Du", startDate: Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date(), endDate: Calendar.current.date(byAdding: .day, value: 2, to: Date()) ?? Date()),
        CalendarEvent(title: "WG-Spieleabend 🎲", person: "Alle", startDate: Date(), endDate: Date())
    ]
    
    @State private var showingAddEventSheet = false
    @State private var newEventTitle = ""
    @State private var newEventPerson = "Du"
    @State private var newEventStartDate = Date()
    @State private var newEventEndDate = Date()
    @State private var newEventIsAllDay = true
    
    private let themeColor = Color(red: 54/255, green: 73/255, blue: 64/255)
    private let calendar = Calendar.current
    
    func formatEventDuration(_ event: CalendarEvent) -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "de_DE")
        
        let startComponents = calendar.dateComponents([.hour, .minute], from: event.startDate)
        let endComponents = calendar.dateComponents([.hour, .minute], from: event.endDate)
        let isAllDay = (startComponents.hour == 0 && startComponents.minute == 0 && endComponents.hour == 0 && endComponents.minute == 0)
        
        if isAllDay {
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .none
            return "Dauer: \(dateFormatter.string(from: event.startDate)) - \(dateFormatter.string(from: event.endDate))"
        } else {
            dateFormatter.dateStyle = .short
            dateFormatter.timeStyle = .short
            return "Zeit: \(dateFormatter.string(from: event.startDate)) bis \(dateFormatter.string(from: event.endDate))"
        }
    }
    
    var monthName: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.setLocalizedDateFormatFromTemplate("MMMM yyyy")
        return formatter.string(from: currentMonthDate)
    }
    
    var daysInMonth: [Date] {
        guard let monthRange = calendar.range(of: .day, in: .month, for: currentMonthDate),
              let firstOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: currentMonthDate))
        else { return [] }
        
        var dates: [Date] = []
        let weekday = calendar.component(.weekday, from: firstOfMonth)
        let daysToSubtract = weekday == 1 ? 6 : weekday - 2
        
        if daysToSubtract > 0 {
            for i in (1...daysToSubtract).reversed() {
                if let date = calendar.date(byAdding: .day, value: -i, to: firstOfMonth) {
                    dates.append(date)
                }
            }
        }
        
        for day in 0..<monthRange.count {
            if let date = calendar.date(byAdding: .day, value: day, to: firstOfMonth) {
                dates.append(date)
            }
        }
        
        while dates.count % 7 != 0 {
            if let lastDate = dates.last, let nextDate = calendar.date(byAdding: .day, value: 1, to: lastDate) {
                dates.append(nextDate)
            }
        }
        
        return dates
    }
    
    var filteredEventsForSelectedDate: [CalendarEvent] {
        events.filter { event in
            let startOfSelected = calendar.startOfDay(for: selectedDate)
            let startOfEventStart = calendar.startOfDay(for: event.startDate)
            let startOfEventEnd = calendar.startOfDay(for: event.endDate)
            return startOfSelected >= startOfEventStart && startOfSelected <= startOfEventEnd
        }
    }
    
    func eventsForDate(_ date: Date) -> [CalendarEvent] {
        events.filter { event in
            let day = calendar.startOfDay(for: date)
            let start = calendar.startOfDay(for: event.startDate)
            let end = calendar.startOfDay(for: event.endDate)
            return day >= start && day <= end
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                
                // KALENDERBLATT Custom Grid
                VStack(spacing: 12) {
                    HStack {
                        Text(monthName)
                            .font(.title3.bold())
                            .foregroundColor(themeColor)
                        Spacer()
                        Button(action: { changeMonth(by: -1) }) {
                            Image(systemName: "chevron.left").bold().padding(8).background(Color.secondary.opacity(0.1)).clipShape(Circle())
                        }
                        Button(action: { changeMonth(by: 1) }) {
                            Image(systemName: "chevron.right").bold().padding(8).background(Color.secondary.opacity(0.1)).clipShape(Circle())
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 10)
                    
                    HStack(spacing: 0) {
                        ForEach(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], id: \.self) { day in
                            Text(day)
                                .font(.caption.bold())
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    
                    let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)
                    LazyVGrid(columns: columns, spacing: 6) {
                        ForEach(daysInMonth, id: \.self) { date in
                            let isCurrentMonth = calendar.isDate(date, equalTo: currentMonthDate, toGranularity: .month)
                            let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
                            let dailyEvents = eventsForDate(date)
                            
                            VStack(spacing: 3) {
                                Text("\(calendar.component(.day, from: date))")
                                    .font(.system(.footnote, design: .rounded))
                                    .fontWeight(isSelected ? .bold : .regular)
                                    .foregroundColor(isSelected ? .white : (isCurrentMonth ? .primary : .secondary.opacity(0.5)))
                                    .frame(width: 24, height: 24)
                                    .background(isSelected ? themeColor : Color.clear)
                                    .clipShape(Circle())
                                
                                VStack(spacing: 2) {
                                    ForEach(dailyEvents.prefix(3)) { event in
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(event.color)
                                            .frame(height: 4)
                                            .padding(.horizontal, 2)
                                    }
                                    if dailyEvents.count > 3 {
                                        Circle().fill(.secondary).frame(width: 3, height: 3)
                                    }
                                }
                                .frame(height: 16, alignment: .top)
                                
                                Spacer(minLength: 0)
                            }
                            .frame(height: 52)
                            .background(isCurrentMonth ? Color.white : Color.secondary.opacity(0.03))
                            .cornerRadius(8)
                            .shadow(color: isSelected ? .clear : Color.black.opacity(0.02), radius: 2)
                            .onTapGesture {
                                selectedDate = date
                            }
                        }
                    }
                    .padding(.horizontal, 6)
                }
                .padding(.bottom, 12)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(20)
                .padding()
                
                List {
                    if filteredEventsForSelectedDate.isEmpty {
                        Text("Keine Termine eingetragen.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .listRowBackground(Color.clear)
                    } else {
                        ForEach(filteredEventsForSelectedDate) { event in
                            HStack(spacing: 0) {
                                Rectangle()
                                    .fill(event.color)
                                    .frame(width: 6)
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(event.title).font(.body.bold())
                                        Spacer()
                                        Text(event.person).font(.caption.bold()).foregroundColor(event.color)
                                    }
                                    Text(formatEventDuration(event))
                                        .font(.caption2).foregroundColor(.secondary)
                                }
                                .padding(.vertical, 10)
                                .padding(.horizontal, 14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(event.color.opacity(0.06))
                            }
                            .cornerRadius(10)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowBackground(Color.clear)
                        }
                        .onDelete { indexSet in
                            let eventsForDay = filteredEventsForSelectedDate
                            for index in indexSet {
                                let eventToDelete = eventsForDay[index]
                                if let globalIndex = events.firstIndex(where: { $0.id == eventToDelete.id }) {
                                    events.remove(at: globalIndex)
                                }
                            }
                        }
                    }
                }
                .listStyle(.plain)
                
                Button {
                    newEventStartDate = selectedDate
                    newEventEndDate = selectedDate
                    newEventIsAllDay = true
                    showingAddEventSheet = true
                } label: {
                    HStack { Image(systemName: "calendar.badge.plus"); Text("Termin / Urlaub eintragen") }.font(.headline).foregroundColor(.white).frame(maxWidth: .infinity).frame(height: 50).background(themeColor).cornerRadius(14).padding()
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("WG-Kalender 📅")
            .sheet(isPresented: $showingAddEventSheet) {
                NavigationStack {
                    Form {
                        Section("Was steht an?") {
                            TextField("z.B. Urlaub 🏖️, Abwesend 🚂", text: $newEventTitle)
                            Picker("Wer?", selection: $newEventPerson) {
                                Text("Du (Grün)").tag("Du")
                                Text("Partner A (Blau)").tag("Partner A")
                                Text("Partner B (Lila)").tag("Partner B")
                                Text("Alle (WG-Grün)").tag("Alle")
                            }
                        }
                        
                        Section("Zeitoption") {
                            Toggle("Ganztägig", isOn: $newEventIsAllDay)
                        }
                        
                        Section("Zeitraum") {
                            DatePicker("Startet", selection: $newEventStartDate, displayedComponents: newEventIsAllDay ? [.date] : [.date, .hourAndMinute])
                                .environment(\.locale, Locale(identifier: "de_DE"))
                            
                            DatePicker("Endet", selection: $newEventEndDate, in: newEventStartDate..., displayedComponents: newEventIsAllDay ? [.date] : [.date, .hourAndMinute])
                                .environment(\.locale, Locale(identifier: "de_DE"))
                        }
                    }
                    .navigationTitle("Neuer Eintrag")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Abbrechen") { showingAddEventSheet = false }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Speichern") {
                                var finalStart = newEventStartDate
                                var finalEnd = newEventEndDate
                                
                                if newEventIsAllDay {
                                    if let sDate = calendar.date(bySettingHour: 0, minute: 0, second: 0, of: newEventStartDate) { finalStart = sDate }
                                    if let eDate = calendar.date(bySettingHour: 0, minute: 0, second: 0, of: newEventEndDate) { finalEnd = eDate }
                                }
                                
                                events.append(CalendarEvent(title: newEventTitle, person: newEventPerson, startDate: finalStart, endDate: finalEnd))
                                showingAddEventSheet = false
                                newEventTitle = ""
                            }.disabled(newEventTitle.isEmpty)
                        }
                    }
                }
            }
        }
    }
    
    private func changeMonth(by value: Int) {
        if let newMonth = calendar.date(byAdding: .month, value: value, to: currentMonthDate) {
            currentMonthDate = newMonth
        }
    }
}

// MARK: - Custom Views & UI-Elemente
struct CustomMoodRoomRowView: View {
    let moodRoom: MoodRoom
    let currentUserName: String
    var onDelete: () -> Void
    var onEdit: () -> Void
    var onExpressMood: () -> Void
    var onLeaveRoom: () -> Void
    
    private var isParticipant: Bool {
        moodRoom.memberMoods.contains(where: { $0.name == currentUserName })
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    // Rein textlicher Name
                    Text(moodRoom.name).font(.headline).foregroundColor(Color(red: 54/255, green: 73/255, blue: 64/255))
                    if !moodRoom.note.isEmpty { Text(moodRoom.note).font(.subheadline).foregroundColor(.secondary) }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        if !moodRoom.memberMoods.isEmpty {
                            Text("Feedback im Raum:").font(.caption.bold()).foregroundColor(.secondary).padding(.top, 4)
                            ForEach(moodRoom.memberMoods) { mood in
                                // Visuelles Feedback rein über das ausgewählte Emoji
                                HStack {
                                    Text("• \(mood.name):")
                                    Text(mood.moodEmoji).font(.title3)
                                }
                                .font(.caption2)
                            }
                        } else {
                            Text("Noch kein Vibe hinterlassen").font(.caption2).foregroundColor(.secondary).padding(.top, 4)
                        }
                    }
                }
                Spacer()
                
                HStack(spacing: 12) {
                    Button(action: onEdit) { Image(systemName: "pencil.circle").foregroundColor(.blue).font(.title3) }.buttonStyle(.borderless)
                    Button(action: onDelete) { Image(systemName: "trash").foregroundColor(.red).font(.subheadline) }.buttonStyle(.borderless)
                }
            }
            
            HStack(spacing: 8) {
                Button(action: onExpressMood) {
                    Text(isParticipant ? "Mein Gefühl anpassen 📝" : "Gefühl eintragen 🤝")
                        .font(.caption.bold())
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(Color(red: 54/255, green: 73/255, blue: 64/255))
                        .cornerRadius(8)
                }.buttonStyle(.borderless)
                
                if isParticipant {
                    Button(action: onLeaveRoom) {
                        Image(systemName: "door.right.hand.open").foregroundColor(.red).frame(width: 32, height: 32).background(Color.red.opacity(0.1)).cornerRadius(8)
                    }.buttonStyle(.borderless)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.02), radius: 4)
    }
}

struct CustomRoomRowView: View {
    let room: Room
    var body: some View {
        HStack(spacing: 16) {
            RoundedRectangle(cornerRadius: 12).fill(room.color.opacity(0.15)).frame(width: 48, height: 48).overlay(Image(systemName: room.icon).foregroundColor(room.color))
            VStack(alignment: .leading, spacing: 4) {
                Text(room.name).font(.body.bold())
                Text(" Zustand: \(room.cleanliness)").font(.subheadline).foregroundColor(.secondary)
                if !room.comment.isEmpty { Text("„\(room.comment)“").font(.caption).italic().foregroundColor(.secondary) }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.footnote).foregroundColor(.secondary)
        }.padding().background(Color(.secondarySystemBackground)).cornerRadius(16)
    }
}

struct ExtendedMoodView: View {
    let name: String; let moodEmoji: String; let status: String; let locationEmoji: String; let locationText: String
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 16) {
                Text(moodEmoji).font(.system(size: 32)).frame(width: 55, height: 55).background(Color.blue.opacity(0.1)).clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(name).font(.headline)
                    Text(status).font(.subheadline.bold()).foregroundColor(.blue)
                    HStack(spacing: 4) { Text(locationEmoji); Text(locationText).font(.caption.bold()) }.padding(.horizontal, 8).padding(.vertical, 3).background(Color.primary.opacity(0.05)).cornerRadius(6)
                }
                Spacer(); Image(systemName: "square.and.pencil").foregroundColor(.secondary)
            }
        }.padding().background(Color(.secondarySystemBackground)).cornerRadius(16)
    }
}

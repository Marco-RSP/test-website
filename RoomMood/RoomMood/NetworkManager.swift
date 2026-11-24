//
//  NetworkManager.swift
//  RoomMood
//
//  Created by MarcoRSP on 09.07.26.
//

import Foundation
import UIKit


class NetworkManager {
    static let shared = NetworkManager() // Singleton für den einfachen Zugriff
    private let baseURL = "http://192.168.2.157:8000" // Hier deine IP eintragen!

    func postData<T: Encodable>(endpoint: String, data: T) {
        guard let url = URL(string: baseURL + endpoint) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONEncoder().encode(data)
            URLSession.shared.dataTask(with: request).resume()
        } catch {
            print("Fehler beim Encoden der Daten: \(error)")
        }
    }
    func fetchItems(completion: @escaping ([ShoppingItem]) -> Void) {
        guard let url = URL(string: baseURL + "/shopping/list") else { return }
        
        URLSession.shared.dataTask(with: url) { data, _, _ in
            if let data = data {
                let items = try? JSONDecoder().decode([ShoppingItem].self, from: data)
                DispatchQueue.main.async {
                    completion(items ?? [])
                }
            }
        }.resume()
    }
    func uploadAvatar(username: String, image: UIImage) {
        // 1. Bild komprimieren (max. 500kb reichen für ein Profilbild völlig aus)
        guard let jpegData = image.jpegData(compressionQuality: 0.5) else { return }
        
        // 2. Base64 kodieren
        let base64String = jpegData.base64EncodedString()
        
        // 3. Payload erstellen (muss exakt dem Pydantic-Modell auf dem Pi entsprechen)
        let body: [String: Any] = [
            "username": username,
            "avatar_data": base64String
        ]
        
        // 4. Request senden
        guard let url = URL(string: "http://192.168.2.157:8000/avatar/upload") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request).resume()
    }
}

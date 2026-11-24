//
//  ShoppingItem.swift
//  RoomMood
//
//  Created by MarcoRSP on 09.07.26.
//

import Foundation

struct ShoppingItem: Codable, Identifiable {
    var id: UUID = UUID() // Hilft SwiftUI, Elemente zu unterscheiden
    var item_name: String
    var isChecked: Bool = false
}

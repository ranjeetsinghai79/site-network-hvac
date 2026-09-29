"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Nav from "@/components/nav"
import Footer from "@/components/footer"

const WIX = "https://static.wixstatic.com/media/"

// Confirmed dish→image mappings from Wix menu
const IMG: Record<string, string> = {
  "Masala Mirchi Bajji": WIX + "97cecd_8861e5d9f1e34b2eb1c78b13299a840f~mv2.jpg",
  "Chicken Taka Tak": WIX + "97cecd_f974c44188a34a3a9f3bdaf0cc77e2fe~mv2.jpg",
  "Dragon Chicken": WIX + "97cecd_a58a675827ec48139dbc221e8d44d1f6~mv2.jpg",
  "Guntur Chicken Fry": WIX + "97cecd_d4b81afa59f54f0f814da4dde1104a8a~mv2.jpg",
  "Curry Leaf Chicken": WIX + "97cecd_d3475656f27e403091f87506ad61c923~mv2.jpg",
  "Chicken Lolipop": WIX + "97cecd_daf66766cbfe47a7b5d27802a242d17f~mv2.jpg",
  "Apollo Fish": WIX + "97cecd_c614729ac4704da1ae1c4b3d67e74fa2~mv2.jpg",
  "Jeera Fried Rice": WIX + "97cecd_400f6f8a600540b5b5ddc4ca7b32ad91~mv2.jpg",
  "Gongura Rice": WIX + "97cecd_474218162c584cad920fc06eacb91f04~mv2.jpg",
  "Chicken Fried Rice": WIX + "97cecd_593ab9abbd1c4c85b6ed15cf07dc4054~mv2.jpg",
  "Veg Fried Rice": WIX + "97cecd_5fab5cd499d04a60a6150790bd6f83a6~mv2.jpg",
  "Dragon Paneer": WIX + "97cecd_33aee7c943eb45c58a5bb9b92f5ed086~mv2.jpg",
  "Masala Mamsam Roast": WIX + "97cecd_23ca11e39c7148889430cf4da143ce32~mv2.jpg",
  "Fish Daniya": WIX + "97cecd_1d4a91173215412eaea3705bb81287dd~mv2.jpg",
  "Chicken Keema Fried Rice": WIX + "97cecd_5d1193a30809482684cc1d485557a70c~mv2.jpg",
  "Double Egg Fried Rice": WIX + "97cecd_2cb3222e42354271a581fecff9b2c981~mv2.jpg",
  "Fried Podi Idli": WIX + "97cecd_52134a292ba348ada938aedfdf276085~mv2.jpg",
  "Blue Fox Chicken": WIX + "97cecd_2e38296535964e8680b0cb5cddeb98a4~mv2.jpg",
  "Masala Mint Rice": WIX + "97cecd_42a5a24b82c34b0dbb18ae058861c58c~mv2.jpg",
  "Chicken Vada": WIX + "97cecd_93774618124b411b92d78689e4257aff~mv2.jpg",
  "Masala Vada": WIX + "97cecd_5efe0a0d2688453d8e6ae9d532973d36~mv2.jpg",
  "Chicken Nuggets": WIX + "97cecd_72bfdd1dae104db9ac15534df5d85b2d~mv2.jpg",
  "Butter Naan": WIX + "97cecd_867dd0d4216a4b8d844072459fcd94c7~mv2.jpg",
  "Masala Puri": WIX + "97cecd_a0ddf8b69a144e6a92ad66b5722c9530~mv2.jpg",
  "Shrimp Sticks": WIX + "97cecd_e705e05310cc4dfab4db9f8b87ba080f~mv2.jpg",
  "Goat Chops": WIX + "97cecd_7202af5c717b402a803f5374477f6945~mv2.jpg",
  "Mutton Keema Fried Rice": WIX + "97cecd_ece5cba651a04cd381e49ee297babefd~mv2.jpg",
  "Mutton Paya Soup": WIX + "97cecd_9d0d8bc1a60e4e8b94f64940255acc8e~mv2.jpg",
  "Veg Cutlet": WIX + "97cecd_3da7148798f246cb86cb087dbbd29fd4~mv2.jpg",
  "Cheese Dosa": WIX + "97cecd_3ee216cd6f9740ae80dddfb5d84b6b66~mv2.jpg",
  "Chicken Keema Dosa": WIX + "97cecd_8d4467c3f46b4aa5991a97d4c81c7f12~mv2.jpg",
  "Chocolate Dosa": WIX + "97cecd_01d95f3551dc490bb638f0081914e3ad~mv2.jpg",
  "Cone Dosa": WIX + "97cecd_63f44cc120ac41f19b2b3c6a8fba034a~mv2.jpg",
  "Dosa Chicken Curry": WIX + "97cecd_72fd84ea70274ef5a043583eea4fde55~mv2.jpg",
  "Dosa Goat Curry": WIX + "97cecd_5d97694bfceb4dfdb5efe8d5399b56fa~mv2.jpg",
  "Ghee Dosa": WIX + "97cecd_f486834d03e24b32b8f8a7e22ec7d390~mv2.jpg",
  "Double Egg Dosa": WIX + "97cecd_5aa084ee58d74ba8b50654712ea146fc~mv2.jpg",
  "Masala Dosa": WIX + "97cecd_a78a8d562d684d2889c4915d61e99d34~mv2.jpg",
  "Gongura Paneer Dosa": WIX + "97cecd_b4622af9e26f4f9f8c393e207ce696ac~mv2.jpg",
  "Mysore Masala Dosa": WIX + "97cecd_1e1c67392f574dbfbfe39daf17b2e930~mv2.jpg",
}

type Dish = { name: string; price: string; desc?: string }

const MENU: Record<string, Dish[]> = {
  "Appetizers": [
    { name: "Masala Mirchi Bajji", price: "$9.99", desc: "Spicy green chilies in crispy batter, deep-fried to perfection" },
    { name: "Gobi-65", price: "$10.99", desc: "Crispy cauliflower in spicy batter" },
    { name: "Baby Corn Pepper Fry", price: "$10.99", desc: "Stir-fried baby corn in crushed peppers and onion" },
    { name: "Chicken-65", price: "$11.99", desc: "Marinated chicken deep-fried, garnished with cilantro" },
    { name: "Chicken Taka Tak", price: "$11.99", desc: "Indian-style chicken stir-fry with herbs and spices" },
    { name: "Dragon Chicken", price: "$11.99", desc: "Spicy chicken in rich sauce with onions and bell peppers" },
    { name: "Guntur Chicken Fry", price: "$11.99", desc: "South Indian chicken with bold Guntur spice" },
    { name: "Curry Leaf Chicken", price: "$11.99", desc: "Aromatic curry leaf chicken with bold spices" },
    { name: "Chicken Lolipop", price: "$12.99", desc: "Crispy chicken wings in sweet and spicy sauce" },
    { name: "Apollo Fish", price: "$14.99", desc: "Pan-seared fish with zesty lemon butter and yogurt sauce" },
    { name: "Shrimp-555", price: "$15.99", desc: "Spicy fried shrimp with Indian spice blend" },
    { name: "Shrimp Sticks", price: "$16.99" },
    { name: "Goat Chops", price: "$19.99" },
    { name: "Dragon Paneer", price: "$11.99", desc: "Paneer in spicy savory sauce" },
    { name: "Masala Mamsam Roast", price: "$14.99", desc: "Mutton slow-roasted in rich spicy masala" },
    { name: "Fish Daniya", price: "$14.99", desc: "Fried tilapia with coriander flavor" },
    { name: "Blue Fox Chicken", price: "$13.99", desc: "Ground chicken balls in house special batter" },
    { name: "Chicken Vada", price: "$11.99", desc: "Crispy fried chicken patties" },
    { name: "Masala Vada", price: "$9.99", desc: "Crispy lentil dumplings with herbs" },
    { name: "Gobi Manchurian", price: "$10.99", desc: "Cauliflower in savory Indo-Chinese sauce" },
    { name: "Fried Podi Idli", price: "$8.99", desc: "Idlis tossed in spicy podi and fried crispy" },
    { name: "Punugulu", price: "$7.99", desc: "Crispy batter balls with chutneys" },
    { name: "Chicken Nuggets", price: "$5.99", desc: "Crispy golden chicken nuggets" },
    { name: "Samosa", price: "$6.99", desc: "Crispy pastry with spiced potatoes and peas" },
    { name: "Veg Cutlet", price: "$9.99" },
    { name: "Pepper Mushrrom", price: "$11.99", desc: "Stir-fried mushroom in crushed peppers" },
    { name: "Jeera Fried Rice", price: "$10.99", desc: "Cumin-spiced rice with coriander" },
    { name: "Gongura Rice", price: "$11.99", desc: "Tangy rice with gongura leaves" },
    { name: "Chicken Fried Rice", price: "$12.99", desc: "Stir-fried rice with chicken and vegetables" },
    { name: "Veg Fried Rice", price: "$10.99", desc: "Stir-fried rice with mixed vegetables" },
    { name: "Masala Mint Rice", price: "$10.99", desc: "Rice infused with mint and spices" },
    { name: "Chicken Keema Fried Rice", price: "$14.99", desc: "Spicy minced chicken rice" },
    { name: "Double Egg Fried Rice", price: "$11.99", desc: "Stir-fried rice with double eggs" },
    { name: "Mutton Keema Fried Rice", price: "$15.99" },
    { name: "Butter Naan", price: "$2.99", desc: "Leavened flatbread with melted butter" },
    { name: "Masala Puri", price: "$7.99", desc: "Crispy puris with tamarind chutney and potatoes" },
    { name: "Cut Mirchi", price: "$7.99", desc: "Spicy green chilies cut into bite-size pieces" },
    { name: "Mutton Paya Soup", price: "$7.99" },
    { name: "French Fries", price: "$4.99", desc: "Golden crispy fries" },
    { name: "Tater Tots", price: "$5.49", desc: "Crispy on the outside, fluffy inside" },
    { name: "Minerva's Veg Pan Indian Dosa(4ft)", price: "$49.99", desc: "4-foot long mixed veg dosa with sambar and chutneys" },
  ],
  "Dosa & Chats": [
    { name: "Masala Dosa", price: "$10.99", desc: "Crispy South Indian crepe with spiced potato filling" },
    { name: "Ghee Dosa", price: "$9.99", desc: "Crispy dosa finished with clarified butter" },
    { name: "Plain Dosa", price: "$8.99" },
    { name: "Mysore Masala Dosa", price: "$10.99", desc: "Spiced masala dosa with Mysore-style chutney" },
    { name: "Onion Dosa", price: "$9.99", desc: "Thin crispy dosa with fresh onions" },
    { name: "Podi Dosa", price: "$10.99", desc: "Dosa with spicy podi (gunpowder) spread" },
    { name: "Paneer Dosa", price: "$10.99", desc: "Crispy dosa with fresh paneer filling" },
    { name: "Gongura Paneer Dosa", price: "$11.99", desc: "Dosa with tangy gongura and paneer" },
    { name: "Vijayawada Paneer Dosa", price: "$11.99", desc: "Vijayawada-style spicy paneer dosa" },
    { name: "Cheese Dosa", price: "$7.99", desc: "Crispy dosa with melted cheese" },
    { name: "Double Egg Dosa", price: "$11.99", desc: "Egg-enriched crispy dosa" },
    { name: "Chicken Keema Dosa", price: "$11.99", desc: "Dosa filled with spiced minced chicken" },
    { name: "Vijayawada Chicken Dosa", price: "$11.99", desc: "Bold Vijayawada-style chicken dosa" },
    { name: "Dosa Chicken Curry", price: "$12.99", desc: "Dosa served with rich chicken curry" },
    { name: "Dosa Goat Curry", price: "$12.99", desc: "Dosa with slow-cooked goat curry" },
    { name: "Cone Dosa", price: "$6.99", desc: "Fun cone-shaped crispy dosa" },
    { name: "Chocolate Dosa", price: "$6.99", desc: "Sweet dosa with chocolate filling" },
    { name: "Rava Dosa", price: "$11.99", desc: "Semolina dosa — thin and lacy" },
    { name: "Plain Uthappam", price: "$9.99", desc: "Thick South Indian pancake" },
    { name: "Chilli Uthappam", price: "$9.99", desc: "Spicy green chili uthappam" },
    { name: "Onion Chili Uthappam", price: "$10.99", desc: "Uthappam with onion and chili" },
    { name: "Mixed Veg Uthappam", price: "$11.99", desc: "Uthappam with mixed vegetables" },
    { name: "Chicken keema Uthappam", price: "$12.99", desc: "Uthappam with spiced minced chicken" },
    { name: "Pesarattu", price: "$9.99", desc: "Green moong dal crepe" },
    { name: "Onion Chili Pesarattu", price: "$10.99" },
    { name: "Upma Pesarattu", price: "$10.99", desc: "Pesarattu stuffed with spiced upma" },
    { name: "Masala Puri", price: "$7.99", desc: "Crispy puris with tamarind and chaat" },
    { name: "Papdi Chat", price: "$7.99", desc: "Crispy papdi with chutneys and yogurt" },
    { name: "Poori", price: "$2.49", desc: "Puffed deep-fried whole wheat bread" },
    { name: "Gobi-65 Biryani", price: "$11.99", desc: "Crispy Gobi-65 layered with fragrant biryani rice" },
    { name: "Egg Keema Pav", price: "$10.99", desc: "Spiced egg keema with soft buns" },
    { name: "Mutton Keema Pav", price: "$12.99", desc: "Rich mutton keema with soft buns" },
    { name: "Minerva's Veg Pan Indian Dosa(4ft)", price: "$49.99", desc: "4-foot showstopper dosa" },
  ],
  "Entrees & Biryanis": [
    { name: "Guntur Chicken Biryani", price: "$13.99", desc: "Bold Guntur-spiced chicken biryani" },
    { name: "Gongura Chicken Biryani", price: "$15.99", desc: "Tangy gongura chicken dum biryani" },
    { name: "Ulavacharu Chicken Biryani", price: "$16.99", desc: "Horse gram broth-infused chicken biryani" },
    { name: "Egg Roast Biryani", price: "$12.99", desc: "Spiced egg roast layered with fragrant rice" },
    { name: "Gongura Paneer Biryani", price: "$14.99", desc: "Tangy gongura and paneer biryani" },
    { name: "Mixed Veg Biryani", price: "$11.99", desc: "Fragrant basmati with mixed vegetables" },
    { name: "Special Paneer Biryani", price: "$12.99", desc: "Chef's special paneer biryani" },
    { name: "Sri Kanya Chicken Fry Piece Biryani", price: "$14.99", desc: "Crispy chicken piece biryani" },
    { name: "Minerva's Spcl Boneless Chicken Biryani", price: "$14.99", desc: "House specialty boneless biryani" },
    { name: "Goat chops Biryani", price: "$19.99", desc: "Tender goat chops dum biryani" },
    { name: "Hyderabadi Mutton Dum Biryani", price: "$16.99", desc: "Classic Hyderabadi dum biryani" },
    { name: "Gongura Mutton Biryani", price: "$17.99", desc: "Tangy gongura mutton biryani" },
    { name: "Ulavacharu Goat Biryani", price: "$17.99", desc: "Ulavacharu-spiced goat biryani" },
    { name: "Baby Goat Roast Biryani", price: "$16.99", desc: "Slow-roasted baby goat biryani" },
    { name: "Shahi Gosht Biryani", price: "$16.99", desc: "Royal-style mutton biryani" },
    { name: "Fish Biryani", price: "$16.99", desc: "Flavorful fish biryani" },
    { name: "Prawns Biryani", price: "$16.99", desc: "Juicy prawns dum biryani" },
    { name: "Goat keema Biryani", price: "$17.99", desc: "Minced goat biryani" },
    { name: "Chicken Keema Biryani", price: "$16.99", desc: "Minced chicken biryani" },
    { name: "Kaju Soya Biryani", price: "$12.99", desc: "Cashew and soya chunks biryani" },
    { name: "Guthi Vankaya Biryani", price: "$12.99", desc: "Stuffed eggplant biryani" },
    { name: "Chicken Fry Piece Pulao", price: "$14.99", desc: "Crispy chicken piece pulao" },
    { name: "Gongura Chicken Pulao", price: "$15.99", desc: "Tangy gongura chicken pulao" },
    { name: "Gongura Paneer Pulao", price: "$14.99" },
    { name: "Gongura Mutton Pulao", price: "$17.99" },
    { name: "Gongura Prawns Pulao", price: "$16.99" },
    { name: "Egg Roast Pulao", price: "$13.99" },
    { name: "Mutton Roast Pulao", price: "$16.99" },
    { name: "Veg Pulao", price: "$10.99" },
    { name: "Guthivankaya Pulao", price: "$12.99" },
    { name: "Kaju Soya Pulao", price: "$12.99" },
    { name: "Sambar Rice", price: "$10.99", desc: "Comfort rice with lentil sambar" },
    { name: "Sambar Chicken Rice", price: "$11.99" },
    { name: "Butter Chicken Masala", price: "$14.99", desc: "Creamy tomato-based butter chicken" },
    { name: "Andhra Chicken Curry", price: "$14.99", desc: "Bold Andhra-style chicken curry" },
    { name: "Chicken Tikka Masala", price: "$14.99", desc: "Tandoor chicken in rich masala" },
    { name: "Palak Chicken", price: "$14.99", desc: "Chicken in creamy spinach gravy" },
    { name: "Chicken Kurma", price: "$14.99", desc: "Mild coconut and nut-based kurma" },
    { name: "Kadai Chicken", price: "$14.99", desc: "Stir-fried chicken in kadai masala" },
    { name: "Kadai Paneer", price: "$11.99", desc: "Paneer in rich kadai masala" },
    { name: "Guntur Gongura Chicken", price: "$15.99", desc: "Fiery Guntur-style gongura chicken" },
    { name: "Chicken Keema Curry", price: "$15.99", desc: "Minced chicken in rich curry" },
    { name: "Baby Goat Curry", price: "$15.99", desc: "Tender baby goat in spiced gravy" },
    { name: "Gongura Goat Curry", price: "$16.99", desc: "Tangy gongura-infused goat curry" },
    { name: "Goat Paya", price: "$16.99", desc: "Slow-cooked goat trotters" },
    { name: "Goat Keema Curry", price: "$16.99", desc: "Minced goat in aromatic curry" },
    { name: "Shrimp Masala", price: "$16.99", desc: "Juicy shrimp in bold masala" },
    { name: "Gongura Shrimp Curry", price: "$16.99", desc: "Tangy gongura shrimp curry" },
    { name: "Nellore Chepala Pulusu", price: "$15.99", desc: "Nellore-style spicy fish curry" },
    { name: "Butter Paneer Masala", price: "$11.99", desc: "Creamy paneer in butter masala" },
    { name: "Paneer Tikka Masala", price: "$11.99", desc: "Grilled paneer in rich masala" },
    { name: "Paneer Saag", price: "$12.99", desc: "Paneer in spiced spinach" },
    { name: "Gongura Paneer", price: "$12.99", desc: "Tangy gongura with soft paneer" },
    { name: "Malai Paneer", price: "$12.99", desc: "Paneer in creamy white gravy" },
    { name: "Kadai Paneer", price: "$11.99", desc: "Paneer in kadai masala" },
    { name: "Cashewnut Masala", price: "$12.99" },
    { name: "Phool Makhana", price: "$11.99", desc: "Lotus seeds in rich gravy" },
    { name: "Kaju Soya", price: "$11.99" },
    { name: "Methi Chaman", price: "$12.99", desc: "Fenugreek-flavored paneer" },
    { name: "Mixed Veg Kurma", price: "$10.99", desc: "Mixed vegetables in coconut kurma" },
    { name: "Bendi Masala", price: "$12.99", desc: "Okra in tangy masala" },
    { name: "Matar Mushroom", price: "$12.99" },
    { name: "Matar Paneer", price: "$12.99", desc: "Classic peas and paneer" },
    { name: "Guthi Vankaya Curry", price: "$11.99", desc: "Stuffed baby eggplant curry" },
    { name: "Channa Masala", price: "$11.99", desc: "Spiced chickpea curry" },
    { name: "Channa Batura(2 Pcs)", price: "$13.99", desc: "Chickpea curry with puffed bread" },
    { name: "Egg Bhurji", price: "$13.99", desc: "Spiced scrambled eggs" },
    { name: "Dalcha", price: "$9.99", desc: "Lentil and vegetable stew" },
    { name: "Dal Tadka", price: "$9.99", desc: "Yellow lentils with spiced tempering" },
    { name: "Mutton Dalcha", price: "$15.99", desc: "Mutton in lentil stew" },
    { name: "White rice &Dal Tadka combo", price: "$8.99" },
    { name: "American Chop Suey-Chicken", price: "$10.99" },
  ],
  "Tandoor": [
    { name: "Chicken Tikka", price: "$12.99", desc: "Marinated chicken grilled in tandoor" },
    { name: "Malai Chicken Tikka", price: "$13.99", desc: "Creamy marinated chicken tikka" },
    { name: "Tandoori Chicken Legs(2 Pcs)", price: "$11.99", desc: "Spiced chicken legs from the clay oven" },
    { name: "Afghani Chicken(2 Pcs)", price: "$12.99", desc: "Creamy Afghani-spiced grilled chicken" },
    { name: "Malai Paneer Tikka", price: "$11.99", desc: "Creamy marinated paneer from tandoor" },
    { name: "Paneer Tikka", price: "$11.99", desc: "Spiced paneer grilled in tandoor" },
    { name: "Masala Grilled Fish", price: "$14.99", desc: "Marinated fish grilled to perfection" },
    { name: "Butter Naan", price: "$2.99", desc: "Soft leavened bread with butter" },
    { name: "Garlic Naan", price: "$3.49", desc: "Naan with roasted garlic" },
    { name: "Plain Naan", price: "$2.49" },
    { name: "Roti", price: "$1.49", desc: "Whole wheat flatbread" },
    { name: "Chapathi", price: "$1.49", desc: "Thin whole wheat flatbread" },
  ],
  "Idli": [
    { name: "Plain Idli", price: "$7.99", desc: "Soft steamed rice cakes with sambar and chutney" },
    { name: "Ghee Idli", price: "$8.99", desc: "Steamed idli finished with warm ghee" },
    { name: "Podi Idli", price: "$8.99", desc: "Idli tossed in spicy podi powder" },
    { name: "Fried Podi Idli", price: "$8.99", desc: "Crispy fried idli with podi" },
    { name: "Guntur Chili Idli", price: "$8.99", desc: "Idli with bold Guntur chili sauce" },
    { name: "Nalla Kaaram Idli", price: "$8.99", desc: "Idli with spicy Andhra podi" },
    { name: "Sambar Idli", price: "$8.99", desc: "Idli soaked in rich sambar" },
  ],
  "Desserts": [
    { name: "Junnu", price: "$5.99", desc: "Traditional milk-based sweet" },
    { name: "Malai Gulab Jamun", price: "$6.99", desc: "Soft milk dumplings in rose syrup" },
    { name: "Shahi Ka Tukda", price: "$5.99", desc: "Royal bread pudding with saffron milk" },
    { name: "Dry Fruit Malai", price: "$6.99", desc: "Cream with dry fruits" },
    { name: "Royal Falooda", price: "$8.99", desc: "Rose milk with basil seeds and vermicelli" },
    { name: "Fruit Custard", price: "$5.99", desc: "Chilled fruit custard with seasonal fruits" },
  ],
  "Juice Bar": [
    { name: "Banana Milk Shake", price: "$6.99" },
    { name: "Strawberry Milk Shake", price: "$6.99" },
    { name: "Oreo Milk Shake", price: "$6.99" },
    { name: "Kit-Kat Milk Shake", price: "$6.99" },
    { name: "Dairy-Milk Choclate Shake", price: "$6.99" },
    { name: "Snickers Milk Shake", price: "$6.99" },
    { name: "Vanilla Milk Shake", price: "$6.99" },
    { name: "Dry Fruit Juice", price: "$6.99" },
    { name: "Mango Juice", price: "$6.99" },
    { name: "Banana Juice", price: "$6.99" },
    { name: "Apple Juice", price: "$6.99" },
    { name: "Grape Juice", price: "$6.99" },
    { name: "Carrot Juice", price: "$6.99" },
    { name: "Pineapple Juice", price: "$6.99" },
    { name: "Strawberry Juice", price: "$6.99" },
    { name: "Water Melon Juice", price: "$6.99" },
    { name: "Chikoo Juice", price: "$6.99" },
  ],
  "Sides": [
    { name: "Raita(4oz)", price: "$0.99", desc: "Yogurt dip" },
    { name: "Chuntey(4oz)", price: "$0.99", desc: "Coconut or mint chutney" },
    { name: "Onion Salad", price: "$0.99" },
    { name: "Sambar(8oz)", price: "$2.99", desc: "Lentil vegetable stew" },
    { name: "White Rice(24 oz)", price: "$3.99" },
    { name: "Biryani Rice(24 oz)", price: "$4.99" },
    { name: "Pulav Rice(24 oz)", price: "$4.99" },
    { name: "Goli Soda", price: "$2.99", desc: "Traditional Indian marble soda" },
  ],
}

const CATEGORY_ICONS: Record<string, string> = {
  "Appetizers": "🥘",
  "Dosa & Chats": "🫓",
  "Entrees & Biryanis": "🍚",
  "Tandoor": "🔥",
  "Idli": "⚪",
  "Desserts": "🍮",
  "Juice Bar": "🥤",
  "Sides": "🥗",
}

// Fallback images per category
const FALLBACK_POOLS: Record<string, string[]> = {
  "Appetizers": [
    WIX + "97cecd_8861e5d9f1e34b2eb1c78b13299a840f~mv2.jpg",
    WIX + "97cecd_a58a675827ec48139dbc221e8d44d1f6~mv2.jpg",
    WIX + "97cecd_d4b81afa59f54f0f814da4dde1104a8a~mv2.jpg",
    WIX + "97cecd_daf66766cbfe47a7b5d27802a242d17f~mv2.jpg",
    WIX + "97cecd_c614729ac4704da1ae1c4b3d67e74fa2~mv2.jpg",
    WIX + "97cecd_33aee7c943eb45c58a5bb9b92f5ed086~mv2.jpg",
  ],
  "Dosa & Chats": [
    WIX + "97cecd_a78a8d562d684d2889c4915d61e99d34~mv2.jpg",
    WIX + "97cecd_3ee216cd6f9740ae80dddfb5d84b6b66~mv2.jpg",
    WIX + "97cecd_8d4467c3f46b4aa5991a97d4c81c7f12~mv2.jpg",
    WIX + "97cecd_f486834d03e24b32b8f8a7e22ec7d390~mv2.jpg",
    WIX + "97cecd_b4622af9e26f4f9f8c393e207ce696ac~mv2.jpg",
    WIX + "97cecd_1e1c67392f574dbfbfe39daf17b2e930~mv2.jpg",
  ],
  "Entrees & Biryanis": [
    WIX + "97cecd_3a46c24b961744d8a815aa91291789b9~mv2.jpg",
    WIX + "97cecd_d4b81afa59f54f0f814da4dde1104a8a~mv2.jpg",
    WIX + "97cecd_23ca11e39c7148889430cf4da143ce32~mv2.jpg",
    WIX + "97cecd_ece5cba651a04cd381e49ee297babefd~mv2.jpg",
    WIX + "97cecd_7202af5c717b402a803f5374477f6945~mv2.jpg",
    WIX + "97cecd_474218162c584cad920fc06eacb91f04~mv2.jpg",
  ],
  "Tandoor": [
    WIX + "97cecd_d4b81afa59f54f0f814da4dde1104a8a~mv2.jpg",
    WIX + "97cecd_a58a675827ec48139dbc221e8d44d1f6~mv2.jpg",
    WIX + "97cecd_d3475656f27e403091f87506ad61c923~mv2.jpg",
    WIX + "97cecd_867dd0d4216a4b8d844072459fcd94c7~mv2.jpg",
  ],
  "Idli": [
    WIX + "97cecd_52134a292ba348ada938aedfdf276085~mv2.jpg",
  ],
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
}

function DishCard({ dish, section, index }: { dish: Dish; section: string; index: number }) {
  const img = IMG[dish.name] ?? (FALLBACK_POOLS[section]?.[index % (FALLBACK_POOLS[section]?.length || 1)] ?? null)
  const isNoBrainer = !img

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`group rounded-xl border transition-colors duration-300 overflow-hidden ${
        isNoBrainer
          ? "bg-surface-800 border-panel hover:border-gold-500/30 flex flex-col justify-between p-5"
          : "bg-surface-800 border-panel hover:border-gold-500/30"
      }`}
    >
      {img && (
        <div className="relative h-40 overflow-hidden shrink-0">
          <Image
            src={img}
            alt={dish.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-800/70 via-transparent to-transparent" />
        </div>
      )}
      <div className={img ? "p-4" : ""}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm md:text-base text-cream leading-snug flex-1">{dish.name}</h3>
          <span className="font-display text-gold-500 text-sm shrink-0 mt-0.5">{dish.price}</span>
        </div>
        {dish.desc && (
          <p className="text-muted text-xs font-body mt-1.5 leading-relaxed line-clamp-2">{dish.desc}</p>
        )}
      </div>
    </motion.div>
  )
}

export default function MenuPage() {
  const sections = Object.keys(MENU)
  const [active, setActive] = useState(sections[0])

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-surface-900">
        {/* Hero */}
        <div className="relative pt-32 pb-16 px-6 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-surface-800/60 to-surface-900" />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url('${WIX}97cecd_3a46c24b961744d8a815aa91291789b9~mv2.jpg')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="relative z-10 max-w-3xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body"
            >
              Authentic Indian Cuisine
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-5xl md:text-6xl text-cream mt-4 mb-5"
            >
              Our Menu
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-16 h-px bg-gold-500 mx-auto mb-6"
            />
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-muted font-body text-base md:text-lg leading-relaxed"
            >
              Over 200 dishes crafted from bold Andhra spices, fragrant Hyderabadi dum, and generations of home cooking.
            </motion.p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="sticky top-0 z-40 bg-surface-900/95 backdrop-blur-md border-b border-panel/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto scrollbar-none py-3">
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => setActive(section)}
                  className={`shrink-0 px-5 py-2.5 rounded-full text-xs font-body tracking-wide transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    active === section
                      ? "bg-gold-500 text-surface-900 font-semibold"
                      : "text-muted hover:text-cream hover:bg-surface-700 border border-panel"
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dishes grid */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              variants={stagger}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
            >
              {/* Section header */}
              <div className="mb-8">
                <h2 className="font-display text-3xl md:text-4xl text-cream">{active}</h2>
                <p className="text-muted text-sm font-body mt-1">{MENU[active].length} items</p>
                <div className="w-12 h-px bg-gold-500 mt-4" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {MENU[active].map((dish, i) => (
                  <DishCard key={dish.name} dish={dish} section={active} index={i} />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Order CTA */}
        <div className="py-16 px-6 text-center border-t border-panel/40">
          <p className="text-muted font-body mb-5">Ready to order?</p>
          <a
            href="https://www.clover.com/online-ordering/minervagrand-tracy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-gold-500 hover:bg-gold-400 text-surface-900 font-semibold px-10 py-4 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-gold-500/20"
          >
            Order Online
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}

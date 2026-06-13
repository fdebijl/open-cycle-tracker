# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.0].define(version: 2024_07_04_204836) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pgcrypto"
  enable_extension "plpgsql"

  create_table "categories", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name"
    t.string "icon"
    t.string "color"
    t.boolean "global", default: false
    t.uuid "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_categories_on_user_id"
  end

  create_table "category_levels", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name"
    t.string "icon"
    t.uuid "category_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_category_levels_on_category_id"
  end

  create_table "cycles", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_cycles_on_user_id"
  end

  create_table "days", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "date"
    t.integer "order"
    t.string "day_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "cycle_id", null: false
    t.uuid "user_id", null: false
    t.index ["cycle_id"], name: "index_days_on_cycle_id"
    t.index ["date"], name: "index_days_on_date", unique: true
    t.index ["user_id"], name: "index_days_on_user_id"
  end

  create_table "factors", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "notes"
    t.uuid "day_id", null: false
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "category_level_id", null: false
    t.index ["category_level_id"], name: "index_factors_on_category_level_id"
    t.index ["day_id"], name: "index_factors_on_day_id"
    t.index ["user_id"], name: "index_factors_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name"
    t.json "info", default: {}, null: false
    t.json "settings", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.string "jti", null: false
    t.boolean "admin", default: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["jti"], name: "index_users_on_jti", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "categories", "users"
  add_foreign_key "category_levels", "categories"
  add_foreign_key "cycles", "users"
  add_foreign_key "days", "cycles"
  add_foreign_key "days", "users"
  add_foreign_key "factors", "category_levels"
  add_foreign_key "factors", "days"
  add_foreign_key "factors", "users"
end

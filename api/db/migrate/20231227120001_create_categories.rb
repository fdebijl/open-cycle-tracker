class CreateCategories < ActiveRecord::Migration[7.0]
  def change
    create_table :categories, id: :uuid do |t|
      t.string :name
      t.string :description
      t.string :icon
      t.string :color
      t.boolean :measurable, default: false
      t.boolean :global, default: false

      t.references :user, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end

class CreateCategoryLevels < ActiveRecord::Migration[7.0]
  def change
    create_table :category_levels, id: :uuid do |t|
      t.string :name
      t.string :icon

      t.references :category, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end

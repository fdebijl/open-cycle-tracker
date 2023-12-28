class AddCategoryLevelToFactor < ActiveRecord::Migration[7.0]
  def change
    add_reference :factors, :category_level, null: false, foreign_key: true, type: :uuid
  end
end

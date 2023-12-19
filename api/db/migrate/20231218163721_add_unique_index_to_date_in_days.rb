class AddUniqueIndexToDateInDays < ActiveRecord::Migration[7.0]
  def change
    add_index :days, :date, unique: true
  end
end
